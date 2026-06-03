import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

function buildPrompt(text: string, format: 'bullets' | 'concise' | 'detailed') {
  const formatInstruction =
    format === 'bullets'
      ? 'Focus primarily on extracting highly structured key bullet points. The "summary" field can be a brief introductory sentence, and "keyTakeaways" should contain 5-8 comprehensive bullet points.'
      : format === 'concise'
      ? 'Focus on generating a short, unified summary paragraph (3-5 sentences) under the "summary" field, and provide 3 key bullet points under "keyTakeaways".'
      : 'Focus on generating a detailed overview (2 paragraphs) under the "summary" field, and provide 5-6 detailed takeaways under "keyTakeaways".'

  return `You are an expert reading assistant. A student is reading a book and wants to get a summary of a section of the text.
Generate a summary based on the following text content.

Text Content:
"${text}"

Instructions:
1. ${formatInstruction}
2. Extract the core arguments, main concepts, and important details.
3. Keep the language clear, educational, and engaging.

IMPORTANT: Respond ONLY with valid JSON in this exact format, with no extra text or markdown code blocks:
{
  "summary": "Summary text here...",
  "keyTakeaways": [
    "takeaway point 1",
    "takeaway point 2",
    "takeaway point 3"
  ]
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, format = 'concise' } = body

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 })
    }

    const prompt = buildPrompt(text, format)

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
            temperature: 0.4,
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
      if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.keyTakeaways)) {
        return NextResponse.json(parsed)
      }
    }

    // Fallback to Gemini
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
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
        if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.keyTakeaways)) {
          return NextResponse.json(parsed)
        }
      }
      return NextResponse.json({ error: 'Failed to generate valid summary format' }, { status: 500 })
    } catch (e) {
      return NextResponse.json({
        error: 'Groq failed: ' + (lastError || 'unknown error') + '. Gemini also failed: ' + (e instanceof Error ? e.message : 'unknown error')
      }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('Summarization API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate summary'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'summarize' })
}
