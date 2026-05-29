import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function buildPrompt(word: string, sentence: string, pageNumber: number | null, translationLanguage: string) {
  const langInstruction =
    translationLanguage && translationLanguage !== 'none'
      ? `Also provide the translation of the word "${word}" in ${translationLanguage === 'hi' ? 'Hindi (Devanagari script)' : translationLanguage === 'mr' ? 'Marathi (Devanagari script)' : translationLanguage === 'es' ? 'Spanish' : translationLanguage === 'fr' ? 'French' : translationLanguage === 'de' ? 'German' : translationLanguage === 'ja' ? 'Japanese' : translationLanguage === 'zh' ? 'Chinese (Simplified)' : translationLanguage === 'pt' ? 'Portuguese' : translationLanguage === 'ar' ? 'Arabic' : translationLanguage === 'ko' ? 'Korean' : translationLanguage === 'ru' ? 'Russian' : 'English'}.`
      : 'Do NOT provide any translation.'

  return `You are an expert English dictionary assistant. A user is reading a PDF and has selected a word they want to understand.

Selected word: "${word}"
Full sentence context: "${sentence}"
Page number: ${pageNumber || 'unknown'}

Based on the sentence context, provide:
1. The contextual meaning of "${word}" as used in this specific sentence (not all possible meanings, just the one that fits the context)
2. The pronunciation in IPA format and also in a simple phonetic respelling format (like "muh-TIK-yuh-luhs")
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
    const body = await req.json()
    const { word, sentence, pageNumber, translationLanguage } = body

    if (!word || !sentence) {
      return NextResponse.json({ error: 'Word and sentence context are required' }, { status: 400 })
    }

    const prompt = buildPrompt(word, sentence, pageNumber, translationLanguage)

    let lastError = ''

    // Try Groq first
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
      try {
        const completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
        })
        const content = completion.choices?.[0]?.message?.content || ''
        if (content) {
          const parsed = parseJSON(content)
          const result = formatResult(parsed, word, content.substring(0, 300))
          if (result) return NextResponse.json(result)
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Groq request failed'
        console.warn('Groq failed:', lastError)
      }
    }

    // Fallback to Gemini
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return NextResponse.json({
        error: 'No AI service available. GROQ_API_KEY may be invalid: ' + lastError || 'unknown error'
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
    } catch (e) {
      return NextResponse.json({
        error: 'Groq failed: ' + (lastError || 'unknown error') + '. Gemini also failed: ' + (e instanceof Error ? e.message : 'unknown error')
      }, { status: 500 })
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
