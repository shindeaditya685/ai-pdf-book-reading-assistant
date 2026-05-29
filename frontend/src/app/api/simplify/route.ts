import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function buildPrompt(sentence: string, translationLanguage: string) {
  return `Simplify this sentence to make it easier to understand. Use simpler words and shorter structure while keeping the original meaning.

Original sentence: "${sentence}"

${translationLanguage && translationLanguage !== 'none' ? `Also provide a translation of the simplified sentence in ${translationLanguage === 'hi' ? 'Hindi (Devanagari script)' : translationLanguage === 'mr' ? 'Marathi (Devanagari script)' : translationLanguage}.` : ''}

IMPORTANT: Respond ONLY with valid JSON in this exact format, no extra text:
{
  "original": "${sentence.replace(/"/g, '\\"')}",
  "simplified": "simplified version here",
  "translation": "translation here or null"
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

function formatResult(parsed: any, sentence: string, fallback: string) {
  if (!parsed) return null
  return {
    original: parsed.original || sentence,
    simplified: parsed.simplified || fallback,
    translation: parsed.translation || null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sentence, translationLanguage } = body

    if (!sentence) {
      return NextResponse.json({ error: 'Sentence is required' }, { status: 400 })
    }

    const prompt = buildPrompt(sentence, translationLanguage)

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
          const result = formatResult(parsed, sentence, content.substring(0, 300))
          if (result) return NextResponse.json(result)
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Groq simplify failed'
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
        const result = formatResult(parsed, sentence, content.substring(0, 300))
        if (result) return NextResponse.json(result)
      }
    } catch (e) {
      return NextResponse.json({
        error: 'Groq failed: ' + (lastError || 'unknown error') + '. Gemini also failed: ' + (e instanceof Error ? e.message : 'unknown error')
      }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('Simplify API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to simplify sentence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
