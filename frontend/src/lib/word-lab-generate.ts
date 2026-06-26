import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

export async function generateWords(count: number, existingWords: string[] = []): Promise<Array<{
  word: string
  pronunciation: string
  meaning: string
  translation: string
  example: string
}>> {
  const prompt = `You are an IELTS vocabulary assistant. Generate ${count} advanced English vocabulary words suitable for IELTS preparation. Each word should be academic and useful for the exam.

For each word, provide:
- word: the vocabulary word
- pronunciation: IPA pronunciation
- meaning: clear definition (1 sentence)
- translation: Hindi translation
- example: example sentence using the word in an academic context

Return ONLY valid JSON in this format, no other text:
{"words": [{"word": "...", "pronunciation": "...", "meaning": "...", "translation": "...", "example": "..."}]}

IMPORTANT: Do NOT include any of these already-existing words: ${existingWords.join(', ') || 'none'}
Make the words challenging but common enough for IELTS (Band 7+ level).`

  let content = ''
  let lastError = ''

  const clients = getGroqClients()
  if (clients.length > 0) {
    for (const client of clients) {
      try {
        const completion = await client.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.8,
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
        return []
      }
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent(prompt)
      content = result.response.text()
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Gemini failed'
      return []
    }
  }

  if (content) {
    const parsed = parseJSON(content)
    if (parsed && Array.isArray(parsed.words)) {
      return parsed.words.slice(0, count)
    }
  }

  return []
}
