import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserFromRequest } from '@/lib/auth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function getGroqClients(): Groq[] {
  const keyEnv = process.env.GROQ_API_KEY || ''
  if (!keyEnv || keyEnv === 'your_groq_api_key_here') return []
  const keys = keyEnv.split(',').map((k) => k.trim()).filter(Boolean)
  return keys.map((apiKey) => new Groq({ apiKey }))
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

function buildPrompt(words: any[], questionType: string): string {
  const wordList = words.map((w: any, i: number) =>
    `[${i}] "${w.word}": means "${w.meaning}", example: "${w.example}"`
  ).join('\n')

  const lines: string[] = [
    'You are a vocabulary testing assistant. Generate test questions for the following English vocabulary words.',
    '',
  ]

  if (questionType === 'mixed') {
    lines.push('For each word, generate ONE question of a randomly chosen type from: fill-blank, multiple-choice, reverse-recall.')
    lines.push('')
    lines.push('Words:')
    lines.push(wordList)
    lines.push('')
    lines.push('Randomly pick one of the three types for each word (fill-blank, multiple-choice, or reverse-recall).')
  } else {
    lines.push('For each word, generate ONE question of type "' + questionType + '".')
    lines.push('')
    lines.push('Words:')
    lines.push(wordList)
    lines.push('')
    lines.push('Generate only the "' + questionType + '" type.')
  }

  lines.push('')
  lines.push('Return ONLY valid JSON in this exact format with no other text:')
  lines.push('{')
  lines.push('  "questions": [')

  if (questionType === 'mixed') {
    lines.push('    {')
    lines.push('      "wordId": "(word index as string)",')
    lines.push('      "word": "the word",')
    lines.push('      "type": "fill-blank or multiple-choice or reverse-recall",')
    lines.push('      "prompt": "the question prompt",')
    lines.push('      "correctAnswer": "the correct answer",')
    lines.push('      "options": ["correct", "wrong1", "wrong2", "wrong3"] (only for multiple-choice),')
    lines.push('      "sentence": "full sentence with word filled in" (only for fill-blank)')
    lines.push('    }')
  } else if (questionType === 'multiple-choice') {
    lines.push('    {')
    lines.push('      "wordId": "(word index as string)",')
    lines.push('      "word": "the word",')
    lines.push('      "type": "multiple-choice",')
    lines.push('      "prompt": "What does the word mean?",')
    lines.push('      "correctAnswer": "the meaning",')
    lines.push('      "options": ["correct meaning", "wrong option 1", "wrong option 2", "wrong option 3"]')
    lines.push('    }')
  } else {
    lines.push('    {')
    lines.push('      "wordId": "(word index as string)",')
    lines.push('      "word": "the word",')
    lines.push('      "type": "' + questionType + '",')
    lines.push('      "prompt": "the question prompt",')
    lines.push('      "correctAnswer": "the correct answer",')
    lines.push('      "sentence": "full sentence with word filled in" (only for fill-blank)')
    lines.push('    }')
  }

  lines.push('  ]')
  lines.push('}')

  return lines.join('\n')
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

async function callAi(prompt: string): Promise<string> {
  let content = ''
  let lastError = ''

  const clients = getGroqClients()
  if (clients.length > 0) {
    for (const client of clients) {
      try {
        const completion = await client.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.4,
        })
        content = completion.choices?.[0]?.message?.content || ''
        if (content) break
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Groq failed'
      }
    }
  }

  if (!content) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      throw new Error('No AI service available')
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    content = result.response.text()
  }

  if (!content) throw new Error('Question generation failed: ' + lastError)
  return content
}

async function generateBatch(words: any[], questionType: string, globalIndexOffset: number): Promise<any[]> {
  console.log(`[custom-test/start] generating batch offset=${globalIndexOffset} count=${words.length}`)
  const prompt = buildPrompt(words, questionType)
  const content = await callAi(prompt)
  const parsed = parseJSON(content)
  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    console.error('[custom-test/start] invalid AI response:', content.slice(0, 200))
    throw new Error('AI returned invalid question format')
  }
  console.log(`[custom-test/start] batch offset=${globalIndexOffset} got ${parsed.questions.length} questions`)
  return parsed.questions.map((q: any, i: number) => ({
    ...q,
    wordId: String(globalIndexOffset + i),
  }))
}

const BATCH_SIZE = 30

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { words, questionType, offset = 0 } = body
    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words array is required' }, { status: 400 })
    }

    const batches = chunkArray(words, BATCH_SIZE)
    const allQuestions: any[] = []

    for (let b = 0; b < batches.length; b++) {
      const batchQuestions = await generateBatch(batches[b], questionType, offset + allQuestions.length)
      allQuestions.push(...batchQuestions)
    }

    return NextResponse.json({ questions: allQuestions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[custom-test/start] error:', msg)
    return NextResponse.json({ error: msg || 'Failed to generate questions' }, { status: 500 })
  }
}
