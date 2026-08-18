import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'

function extractRetryAfter(errorMessage: string): { retryAfter: number | null; dailyQuota: boolean } {
  const isDaily = /\blimit:\s*0\b/.test(errorMessage) || /exceeded your current quota/i.test(errorMessage)
  if (isDaily) return { retryAfter: null, dailyQuota: true }

  const match = errorMessage.match(/retry in (\d+(?:\.\d+)?)\s*s/i) || errorMessage.match(/retryDelay["':]\s*"?(\d+(?:\.\d+)?)s?/i)
  if (match) return { retryAfter: Math.ceil(parseFloat(match[1])), dailyQuota: false }

  const statusMatch = errorMessage.match(/429|Too Many Requests|quota/i)
  return { retryAfter: statusMatch ? 30 : null, dailyQuota: false }
}

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
    const gate = await gateAiRequest(req, 'summary')
    if (gate.kind !== 'allow') return gate.response

    try {
      const body = await req.json()
      const { text, format = 'concise' } = body

      if (!text || !text.trim()) {
        await refundIfFailed(gate.userId, 'summary')
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
              model: 'openai/gpt-oss-120b',
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
      } else {
        lastError = 'No GROQ_API_KEY configured'
      }

      if (content) {
        const parsed = parseJSON(content)
        if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.keyTakeaways)) {
          return NextResponse.json(parsed)
        }
      }

      // Fallback to Gemini
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
        await refundIfFailed(gate.userId, 'summary')
        return NextResponse.json({
          error: `No AI service available. GROQ_API_KEY may be invalid: ${lastError || 'unknown error'}`
        }, { status: 500 })
      }

      for (const modelName of ['gemini-3.6-flash']) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName })
          const genResult = await model.generateContent(prompt)
          const text = genResult.response.text()
          if (text) {
            const parsed = parseJSON(text)
            if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.keyTakeaways)) {
              return NextResponse.json(parsed)
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : ''
          if (/\blimit:\s*0\b/.test(msg)) {
            await refundIfFailed(gate.userId, 'summary')
            return NextResponse.json({
              error: 'AI daily quota exceeded. Try again tomorrow or add a paid API key.',
              dailyQuota: true,
              retryAfter: null,
            }, { status: 429 })
          }
          console.warn(`Gemini model ${modelName} failed:`, msg)
        }
      }
      await refundIfFailed(gate.userId, 'summary')
      const lastGeminiError = 'All Gemini models failed'
      const { retryAfter } = extractRetryAfter(lastGeminiError)
      return NextResponse.json({
        error: 'Groq failed: ' + (lastError || 'unknown error') + '. Gemini also failed.',
        retryAfter,
      }, { status: 500 })
    } catch (innerErr) {
      await refundIfFailed(gate.userId, 'summary')
      throw innerErr
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
