import { NextRequest, NextResponse } from 'next/server'
import { aiClient, AIClientError } from '@/lib/ai-client'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'

interface VocabItem {
  word: string
  definition: string
  example: string
}

interface VocabTopicData {
  topic: string
  icon: string
  items: VocabItem[]
}

function buildPrompt(topic: string) {
  return `You are an expert IELTS trainer. Generate a list of 8 high-level IELTS academic vocabulary words (Band 7-9 level) related to the topic.

TOPIC: ${topic}

Respond ONLY with valid JSON in this exact format, no extra text or markdown:
{
  "topic": "${topic}",
  "icon": "🎓",
  "items": [
    {
      "word": "word here",
      "definition": "definition of the word here",
      "example": "An example sentence using the word in context."
    }
  ]
}
`
}

export async function POST(req: NextRequest) {
  try {
    const gate = await gateAiRequest(req, 'ielts')
    if (gate.kind !== 'allow') return gate.response

    try {
      const body = await req.json()
      const { topic } = body

      if (!topic || !topic.trim()) {
        await refundIfFailed(gate.userId, 'ielts')
        return NextResponse.json({ error: 'A topic is required' }, { status: 400 })
      }

      const prompt = buildPrompt(topic.trim())
      const vocabTopic = await aiClient.generateJSON<VocabTopicData>(prompt)

      return NextResponse.json(vocabTopic)
    } catch (error: unknown) {
      await refundIfFailed(gate.userId, 'ielts')
      console.error('IELTS vocab generation error:', error)
      if (error instanceof AIClientError) {
        return NextResponse.json({ error: error.message }, { status: error.status || 500 })
      }
      const message = error instanceof Error ? error.message : 'Failed to generate vocabulary topic'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('IELTS gate error:', error)
    const message = error instanceof Error ? error.message : 'Failed to initialize request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ielts/generate-vocab' })
}
