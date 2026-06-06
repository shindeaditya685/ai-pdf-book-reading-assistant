import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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

const ACCENT_NAMES: Record<string, string> = {
  'en-US': 'American English',
  'en-GB': 'British English',
  'en-AU': 'Australian English',
  'en-IN': 'Indian English',
}

function buildPrompt(word: string, sentence: string, pageNumber: number | null, translationLanguage: string, accent: string) {
  const langInstruction =
    translationLanguage && translationLanguage !== 'none'
      ? `Also provide the translation of the word "${word}" in ${LANGUAGE_NAMES[translationLanguage] || 'English'}.`
      : 'Do NOT provide any translation.'

  const accentName = ACCENT_NAMES[accent] || 'American English'

  return `You are an expert English dictionary assistant. A user is reading a PDF and has selected a word they want to understand.

Selected word: "${word}"
Full sentence context: "${sentence}"
Page number: ${pageNumber || 'unknown'}
Accent: ${accentName}

Based on the sentence context, provide:
1. The contextual meaning of "${word}" as used in this specific sentence (not all possible meanings, just the one that fits the context)
2. The pronunciation in IPA format and also in a simple phonetic respelling format (like "muh-TIK-yuh-luhs") — use the accent (${accentName}) for pronunciation
${langInstruction}

IMPORTANT: Respond ONLY with valid JSON in this exact format, no extra text:
{
  "word": "${word}",
  "meaning": "the contextual meaning here",
  "pronunciation_ipa": "IPA pronunciation here",
  "pronunciation_phonetic": "simple phonetic respelling here",
  "translation": "translation here or null if not requested"
}`
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

function formatResult(parsed: any, word: string, fallback: string) {
  if (!parsed) return null
  return {
    word: parsed.word || word,
    meaning: parsed.meaning || fallback,
    pronunciation: parsed.pronunciation_ipa
      ? `${parsed.pronunciation_ipa} (${parsed.pronunciation_phonetic || ''})`
      : parsed.pronunciation_phonetic || '',
    translation: parsed.translation || null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await gateAiRequest(req, 'translation')
    if (gate.kind !== 'allow') return gate.response

    try {
      const body = await req.json()
      const { word, sentence, pageNumber, translationLanguage, accent } = body

      if (!word || !sentence) {
        await refundIfFailed(gate.userId, 'translation')
        return NextResponse.json({ error: 'Word and sentence context are required' }, { status: 400 })
      }

      const prompt = buildPrompt(word, sentence, pageNumber, translationLanguage, accent)

      let lastError = ''
      let content = ''

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
            content = completion.choices?.[0]?.message?.content || ''
            if (content) {
              break // Success!
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'Groq request failed'
            console.warn(`Groq key index ${i} failed:`, lastError)
          }
        }
      }

      if (content) {
        const parsed = parseJSON(content)
        const result = formatResult(parsed, word, content.substring(0, 300))
        if (result) return NextResponse.json(result)
      }

      // Fallback to Gemini
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
        await refundIfFailed(gate.userId, 'translation')
        return NextResponse.json({
          error: `No AI service available. GROQ_API_KEY may be invalid: ${lastError || 'unknown error'}`
        }, { status: 500 })
      }

      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const genResult = await model.generateContent(prompt)
        const content = genResult.response.text()
        if (content) {
          const parsed = parseJSON(content)
          const result = formatResult(parsed, word, content.substring(0, 300))
          if (result) return NextResponse.json(result)
        }
        await refundIfFailed(gate.userId, 'translation')
        return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 })
      } catch (e) {
        await refundIfFailed(gate.userId, 'translation')
        return NextResponse.json({
          error: 'Groq failed: ' + (lastError || 'unknown error') + '. Gemini also failed: ' + (e instanceof Error ? e.message : 'unknown error')
        }, { status: 500 })
      }
    } catch (innerErr) {
      await refundIfFailed(gate.userId, 'translation')
      throw innerErr
    }
  } catch (error: unknown) {
    console.error('Explain API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to get explanation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'explain' })
}
