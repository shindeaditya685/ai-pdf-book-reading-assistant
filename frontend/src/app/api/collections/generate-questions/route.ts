import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'
import { getUserFromRequest } from '@/lib/auth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const BATCH_SIZE = 15

const TYPE_LABELS: Record<string, string> = {
  'multiple-choice': 'Multiple Choice',
  'fill-blank': 'Fill in the Blank',
  'reverse-recall': 'Reverse Recall',
}

const TYPE_INSTRUCTIONS: Record<string, string> = {
  'multiple-choice': `For each word, create a "multiple-choice" question. The question asks "What does [word] mean?" with 4 options (one correct meaning, three plausible wrong ones). The wrong options must NOT be meanings of any other word in this batch.`,
  'fill-blank': `For each word, create a "fill-blank" question. Write a sentence with "__________" where only the target word fits naturally. The sentence must differ from the word's example. The blank must be placed so no other word from the batch could fit.`,
  'reverse-recall': `For each word, create a "reverse-recall" question. Provide a definition or clue that uniquely points to the target word. The clue must be specific enough that no other word in the batch could be the answer.`,
}

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
  const clients = shuffleArray(getGroqClients())
  if (clients.length > 0) {
    for (let i = 0; i < clients.length; i++) {
      try {
        const completion = await clients[i].chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.4,
        })
        const content = completion.choices?.[0]?.message?.content || ''
        if (content) return content
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Groq request failed'
      }
    }
  }

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
    throw new Error(e instanceof Error ? e.message : 'Gemini failed')
  }
}

function buildPrompt(words: { word: string; meaning: string; example: string }[], questionType: string) {
  const wordList = words.map((w, i) => `[${i}] "${w.word}": means "${w.meaning}"${w.example ? `, example: "${w.example}"` : ''}`).join('\n')

  let typeInstruction: string
  if (questionType === 'mixed') {
    const types = ['multiple-choice', 'fill-blank', 'reverse-recall']
    typeInstruction = words.map((_, i) => {
      const t = types[i % types.length]
      return `${TYPE_INSTRUCTIONS[t].replace('For each word, ', `For word index ${i}, `)}`
    }).join('\n\n')
  } else {
    typeInstruction = TYPE_INSTRUCTIONS[questionType] || TYPE_INSTRUCTIONS['mixed']
  }

  return `You are a precise vocabulary testing assistant. Generate unambiguous test questions for these English words:

Words (with index, meaning, and example):
${wordList}

${questionType === 'mixed'
  ? 'Distribute question types evenly across the words (multiple-choice, fill-blank, reverse-recall). Each word gets ONE question, cycling through the types.'
  : `Generate ONE "${TYPE_LABELS[questionType] || questionType}" question per word.`}

Rules:
- Each question must have exactly one unambiguous correct answer
- Wrong options (for multiple-choice) must be clearly incorrect
- Fill-blank sentences must be different from the word's own example
- The blank (__________) must only fit the target word, not any other word in this list
- Reverse-recall clues must be specific enough to identify only the target word

Return ONLY valid JSON — an object with a "questions" array. No extra text:
{
  "questions": [
    {
      "wordId": "(index as string, e.g. "0")",
      "word": "the word",
      "type": "multiple-choice" | "fill-blank" | "reverse-recall",
      "prompt": "the question text",
      "correctAnswer": "the correct answer",
      "options": ["option1", "option2", "option3", "option4"],
      "sentence": "the fill-blank full sentence (omit for multiple-choice)"
    }
  ]
}

IMPORTANT: Include ALL words. Do not skip any.`
}

export async function POST(req: Request) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { words, questionType = 'mixed' } = body
    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words array is required' }, { status: 400 })
    }

    const allQuestions: any[] = []
    const errors: string[] = []

    // Process in batches
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      const batch = words.slice(i, i + BATCH_SIZE)

      const gate = await gateAiRequest(req, 'question')
      if (gate.kind !== 'allow') {
        if (allQuestions.length === 0) return gate.response
        errors.push(`Stopped at batch ${Math.floor(i / BATCH_SIZE) + 1}: quota limit reached`)
        break
      }

      try {
        const prompt = buildPrompt(batch, questionType)
        const content = await callAi(prompt)
        const parsed = parseJSON(content)
        if (!parsed || !Array.isArray(parsed.questions)) {
          throw new Error('Invalid AI response format')
        }
        allQuestions.push(...parsed.questions)
      } catch (e) {
        await refundIfFailed(gate.userId, 'question')
        const msg = e instanceof Error ? e.message : 'Question generation failed'
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`)
      }
    }

    return NextResponse.json({
      questions: allQuestions,
      errors: errors.length > 0 ? errors : undefined,
      totalGenerated: allQuestions.length,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
