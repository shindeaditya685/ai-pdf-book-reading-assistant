import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { newCardDefaults } from '@/lib/fsrs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const BATCH_SIZE = 20
const MAX_WORDS = 100

function getGroqClients(): Groq[] {
  const keyEnv = process.env.GROQ_API_KEY || ''
  if (!keyEnv || keyEnv === 'your_groq_api_key_here') return []
  const keys = keyEnv.split(',').map((k) => k.trim()).filter(Boolean)
  return keys.map((apiKey) => new Groq({ apiKey }))
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const LANGUAGE_NAMES: Record<string, string> = {
  hi: 'Hindi (Devanagari script)',
  mr: 'Marathi (Devanagari script)',
  bn: 'Bengali (Bangla script)',
  or: 'Odia (Odia script)',
  kn: 'Kannada (Kannada script)',
  te: 'Telugu (Telugu script)',
  ta: 'Tamil (Tamil script)',
  pa: 'Punjabi (Gurmukhi script)',
  ml: 'Malayalam (Malayalam script)',
  ur: 'Urdu (Nastaliq script)',
  gu: 'Gujarati (Gujarati script)',
  ne: 'Nepali (Devanagari script)',
  id: 'Indonesian (Latin script)',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
  tr: 'Turkish',
  ku: 'Kurdish (Kurmanji)',
  am: 'Amharic (Geʻez script)',
  uz: 'Uzbek (Latin script)',
  vi: 'Vietnamese (Latin script)',
  ps: 'Pashto (Naskh script)',
  fa: 'Farsi (Perso-Arabic script)',
}

function buildBulkPrompt(words: string[], translationLanguage: string) {
  const safeWords = words.map((w) => String(w).slice(0, 100).trim()).filter(Boolean)
  const langInstruction =
    translationLanguage && translationLanguage !== 'none'
      ? `Also provide the translation of each word in ${LANGUAGE_NAMES[translationLanguage] || 'English'}.`
      : 'Do NOT provide any translation.'

  return `You are an expert English dictionary assistant. A user wants to look up the following English words:

Words: ${JSON.stringify(safeWords)}

For each word, provide:
1. The meaning in English (concise, 1-2 sentences)
2. The pronunciation in IPA format
3. The part of speech (e.g. noun, verb, adjective, adverb)
4. A simple example sentence using the word in an everyday context
${langInstruction}

IMPORTANT: Respond ONLY with valid JSON — an array of objects, no extra text. Use this exact format:
[
  {
    "word": "example",
    "meaning": "a thing serving as a model",
    "pronunciation": "/ɪɡˈzæmpəl/",
    "part_of_speech": "noun",
    "example": "This sentence is an example of how to use the word.",
    "translation": "translation here or null if not requested"
  }
]

Include ALL words in the response array, in the same order as provided. Do not skip any word. If a word is invalid or unknown, still include it with a brief meaning.`
}

function parseJSON(content: string) {
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

async function callAi(prompt: string): Promise<string> {
  let lastError = ''

  // Try Groq first with multi-key failover
  const clients = shuffleArray(getGroqClients())
  if (clients.length > 0) {
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i]
      try {
        const completion = await client.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
        })
        const content = completion.choices?.[0]?.message?.content || ''
        if (content) return content
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Groq request failed'
        console.warn(`Groq key index ${i} failed:`, lastError)
      }
    }
  }

  // Fallback to Gemini
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error(lastError || 'All AI providers unavailable')
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    const content = result.response.text()
    if (content) return content
    throw new Error('Gemini returned empty response')
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'All AI providers failed')
  }
}

async function processBatch(
  words: string[],
  username: string,
  translationLanguage: string,
  createFlashcards: boolean,
  conn: Awaited<ReturnType<typeof connectToDatabase>>,
): Promise<{ added: number; words: { word: string; meaning: string; translation?: string }[]; errors: string[] }> {
  const result = { added: 0, words: [] as { word: string; meaning: string; translation?: string }[], errors: [] as string[] }

  const prompt = buildBulkPrompt(words, translationLanguage)
  const content = await callAi(prompt)
  const parsed = parseJSON(content)
  if (!parsed || !Array.isArray(parsed)) {
    throw new Error('AI returned invalid response format')
  }

  const historyDocs: any[] = []
  const flashcardDocs: any[] = []
  const now = new Date()
  const nowISO = now.toISOString()
  const source = 'bulk-import'

  for (const item of parsed) {
    if (!item || !item.word) continue
    const w = String(item.word).trim()
    if (!w) continue

    historyDocs.push({
      word: w,
      meaning: item.meaning || '',
      pronunciation: item.pronunciation || '',
      translation: item.translation || null,
      sentence: item.example || '',
      pageNumber: 0,
      pdfFileName: source,
      username,
      timestamp: now,
    })

    if (createFlashcards) {
      const defaults = newCardDefaults()
      flashcardDocs.push({
        word: w,
        meaning: item.meaning || '',
        pronunciation: item.pronunciation || '',
        translation: item.translation || '',
        sentence: item.example || '',
        pageNumber: 0,
        pdfFileName: source,
        partOfSpeech: item.part_of_speech || '',
        example: item.example || '',
        username,
        ...defaults,
      })
    }

    result.words.push({ word: w, meaning: item.meaning || '', translation: item.translation || undefined })
    result.added++
  }

  if (historyDocs.length > 0) {
    await conn!.db.collection('wordHistory').insertMany(historyDocs)
  }
  if (flashcardDocs.length > 0) {
    await conn!.db.collection('flashcards').insertMany(flashcardDocs)
  }

  return result
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const rawInput = body.words
    const createFlashcards = body.createFlashcards === true
    const translationLanguage = body.translationLanguage || 'none'
    const collectionName = body.collectionName?.trim()

    if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
      return NextResponse.json({ error: 'Please provide at least one word' }, { status: 400 })
    }

    // Parse, deduplicate, and validate
    let words = rawInput
      .split(/[,]+/)
      .map((w: string) => w.trim().toLowerCase())
      .filter(Boolean)

    words = [...new Set(words)]

    if (words.length > MAX_WORDS) {
      return NextResponse.json({
        error: `Maximum ${MAX_WORDS} words allowed. You provided ${words.length}.`,
      }, { status: 400 })
    }

    if (words.length === 0) {
      return NextResponse.json({ error: 'No valid words found after parsing' }, { status: 400 })
    }

    // Split into batches
    const batches: string[][] = []
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      batches.push(words.slice(i, i + BATCH_SIZE))
    }

    // Gate AI quota — consume one unit per batch
    const gate = await gateAiRequest(req, 'bulk_lookup')
    if (gate.kind !== 'allow') return gate.response

    const conn = await connectToDatabase()
    if (!conn) {
      await refundIfFailed(gate.userId, 'bulk_lookup')
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    const allResults: { word: string; meaning: string; translation?: string }[] = []
    const allErrors: string[] = []
    let totalAdded = 0

    for (let b = 0; b < batches.length; b++) {
      try {
        const batchResult = await processBatch(
          batches[b],
          user.username,
          translationLanguage,
          createFlashcards,
          conn,
        )
        totalAdded += batchResult.added
        allResults.push(...batchResult.words)
      } catch (e) {
        const msg = e instanceof Error ? e.message : `Batch ${b + 1} failed`
        allErrors.push(`Batch ${b + 1} (${batches[b].length} words): ${msg}`)
      }
    }

    // Refund unused quota if last batch didn't consume (in case of empty results)
    if (allErrors.length > 0 && allResults.length === 0) {
      await refundIfFailed(gate.userId, 'bulk_lookup')
    }

    // Save to collection if a name was provided
    let collection: { _id: string; name: string; wordCount: number } | null = null
    if (collectionName && allResults.length > 0) {
      const now = new Date()
      const collectionWords = allResults.map((r, i) => ({
        word: r.word,
        meaning: r.meaning,
        pronunciation: '',
        translation: r.translation || null,
        partOfSpeech: '',
        example: '',
        order: i,
        createdAt: now,
      }))

      // Upsert collection (find by name or create)
      const existing = await conn.db.collection('collections').findOne({
        username: user.username,
        name: collectionName,
      })

      if (existing) {
        await conn.db.collection('collections').updateOne(
          { _id: existing._id },
          {
            $push: { words: { $each: collectionWords } } as any,
            $inc: { wordCount: collectionWords.length },
            $set: { updatedAt: now },
          },
        )
        collection = { _id: existing._id.toString(), name: collectionName, wordCount: (existing.wordCount || 0) + collectionWords.length }
      } else {
        const doc = {
          username: user.username,
          name: collectionName,
          description: '',
          words: collectionWords,
          wordCount: collectionWords.length,
          createdAt: now,
          updatedAt: now,
        }
        const result = await conn.db.collection('collections').insertOne(doc)
        collection = { _id: result.insertedId.toString(), name: collectionName, wordCount: collectionWords.length }
      }
    }

    return NextResponse.json({
      success: true,
      totalRequested: words.length,
      totalAdded,
      totalBatches: batches.length,
      words: allResults,
      errors: allErrors.length > 0 ? allErrors : undefined,
      flashcardCount: createFlashcards ? totalAdded : 0,
      collection,
    })
  } catch (error: unknown) {
    console.error('Bulk vocabulary API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process bulk words' },
      { status: 500 },
    )
  }
}
