import { NextRequest, NextResponse } from 'next/server'
import { aiClient, AIClientError } from '@/lib/ai-client'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'

interface SpeakingCardData {
  id: string
  part: number
  question: string
  followUp: string[]
  prepTime?: number
  speakTime?: number
}

function buildPrompt(topic: string) {
  return `You are an expert IELTS Speaking examiner. Generate an IELTS Speaking Cue Card (Part 2) and follow-up discussion questions (Part 3) based on the topic.

TOPIC: ${topic}

Respond ONLY with valid JSON in this exact format, no extra text or markdown:
{
  "id": "ai-speaking-generated-1",
  "part": 2,
  "question": "Describe a time when you...\\n\\nYou should say:\\n• What it was\\n• When it happened\\n• Who you were with\\n• And explain how you felt about it",
  "followUp": [
    "How does this topic affect society in general?",
    "Do you think people's attitudes towards this will change in the future?",
    "What are the advantages and disadvantages of this?"
  ],
  "prepTime": 60,
  "speakTime": 120
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
      const speakingCard = await aiClient.generateJSON<SpeakingCardData>(prompt)

      return NextResponse.json(speakingCard)
    } catch (error: unknown) {
      await refundIfFailed(gate.userId, 'ielts')
      console.error('IELTS speaking generation error:', error)
      if (error instanceof AIClientError) {
        return NextResponse.json({ error: error.message }, { status: error.status || 500 })
      }
      const message = error instanceof Error ? error.message : 'Failed to generate speaking card'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('IELTS gate error:', error)
    const message = error instanceof Error ? error.message : 'Failed to initialize request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ielts/generate-speaking' })
}
