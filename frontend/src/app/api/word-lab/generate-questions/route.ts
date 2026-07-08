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

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { words } = body
    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words array is required' }, { status: 400 })
    }

    const wordList = words.map((w: any) => `"${w.word}": means "${w.meaning}", example: "${w.example}"`).join('\n')

    const prompt = `You are a vocabulary testing assistant. Generate clear, unambiguous test questions for the following English vocabulary words.

For each word, generate ALL THREE question types. The questions must be precise — there should be exactly one correct answer with no ambiguity.

Words:
${wordList}

For EACH word, generate these 3 question types:
1. "fill-blank": A sentence with a blank (use "__________") where ONLY the target word fits naturally. The sentence must be DIFFERENT from the word's example sentence. The blank must be at a position where no other word from the list could fit.
2. "multiple-choice": The question asks "What does "[word]" mean?" with 4 options. The correct answer is the word's meaning. The 3 wrong options must be realistic but clearly incorrect — they should NOT be meanings of any other word in this list.
3. "reverse-recall": A definition/clue that uniquely points to the target word. The definition must be specific enough that no other word in the list could be the answer.

Return ONLY valid JSON in this exact format with no other text:
{
  "questions": [
    {
      "wordId": "(word's index in the input array as string)",
      "word": "the word",
      "type": "fill-blank",
      "prompt": "sentence with __________ blank",
      "correctAnswer": "the word",
      "sentence": "the full sentence with the word filled in"
    },
    {
      "wordId": "(same index)",
      "word": "the word",
      "type": "multiple-choice",
      "prompt": "What does "[word]" mean?",
      "correctAnswer": "the meaning",
      "options": ["correct meaning", "wrong option 1", "wrong option 2", "wrong option 3"]
    },
    {
      "wordId": "(same index)",
      "word": "the word",
      "type": "reverse-recall",
      "prompt": "unambiguous definition/clue",
      "correctAnswer": "the word"
    }
  ]
}`

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
      try {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
          return NextResponse.json({ error: 'No AI service available' }, { status: 500 })
        }
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const result = await model.generateContent(prompt)
        content = result.response.text()
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Gemini failed'
      }
    }

    if (!content) {
      return NextResponse.json({ error: `Question generation failed: ${lastError}` }, { status: 500 })
    }

    const parsed = parseJSON(content)
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return NextResponse.json({ error: 'AI returned invalid question format' }, { status: 500 })
    }

    return NextResponse.json({ questions: parsed.questions })
  } catch {
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
