import { NextRequest, NextResponse } from 'next/server'
import { aiClient, AIClientError } from '@/lib/ai-client'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'

interface SpeakingEvaluationData {
  overallBand: number
  scores: {
    fluencyCoherence: number
    lexicalResource: number
    grammarAccuracy: number
  }
  analysis: {
    fluencyCoherence: string
    lexicalResource: string
    grammarAccuracy: string
  }
  suggestions: string[]
  modelAnswer: string
}

function buildPrompt(question: string, transcript: string) {
  return `You are an expert IELTS Speaking examiner. Evaluate the student's response based on the transcribed text.

CUE CARD / PROMPT:
${question}

STUDENT'S TRANSCRIBED RESPONSE:
${transcript}

Evaluate based on IELTS criteria:
1. Overall Estimated Band Score (0-9, in 0.5 increments like 6.5)
2. Criteria Scores (0-9 each, in 0.5 increments):
   - Fluency and Coherence (FC)
   - Lexical Resource (LR)
   - Grammatical Range and Accuracy (GRA)
3. Detailed Criteria Analysis:
   - Analysis of FC, LR, and GRA, highlighting strengths, weaknesses, and key points (like grammar errors, repetitive words, filler usage like "um"/"uh").
4. Specific Suggestions for Improvement:
   - List 2-3 specific suggestions on how to improve this response (e.g. synonyms to use, sentence structural changes, etc.)
5. Model Response:
   - Provide a model spoken response that would achieve a high band score (Band 8+).

Respond ONLY with valid JSON in this exact format, no extra text or markdown:
{
  "overallBand": 6.5,
  "scores": {
    "fluencyCoherence": 6.0,
    "lexicalResource": 6.5,
    "grammarAccuracy": 7.0
  },
  "analysis": {
    "fluencyCoherence": "Feedback...",
    "lexicalResource": "Feedback...",
    "grammarAccuracy": "Feedback..."
  },
  "suggestions": [
    "suggestion 1",
    "suggestion 2"
  ],
  "modelAnswer": "Improved speech content..."
}
`
}

export async function POST(req: NextRequest) {
  try {
    const gate = await gateAiRequest(req, 'ielts')
    if (gate.kind !== 'allow') return gate.response

    try {
      const body = await req.json()
      const { question, transcript } = body

      if (!question || !transcript || !transcript.trim()) {
        await refundIfFailed(gate.userId, 'ielts')
        return NextResponse.json({ error: 'Question and transcript are required' }, { status: 400 })
      }

      const promptString = buildPrompt(question, transcript.trim())
      const evaluation = await aiClient.generateJSON<SpeakingEvaluationData>(promptString)

      return NextResponse.json(evaluation)
    } catch (error: unknown) {
      await refundIfFailed(gate.userId, 'ielts')
      console.error('IELTS speaking evaluation error:', error)
      if (error instanceof AIClientError) {
        return NextResponse.json({ error: error.message }, { status: error.status || 500 })
      }
      const message = error instanceof Error ? error.message : 'Failed to evaluate IELTS speaking'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('IELTS gate error:', error)
    const message = error instanceof Error ? error.message : 'Failed to initialize request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ielts/evaluate-speaking' })
}
