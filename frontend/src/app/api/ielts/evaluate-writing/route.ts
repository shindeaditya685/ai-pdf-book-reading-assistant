import { NextRequest, NextResponse } from 'next/server'
import { aiClient, AIClientError } from '@/lib/ai-client'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'

interface WritingEvaluationData {
  overallBand: number
  scores: {
    taskAchievement: number
    coherenceCohesion: number
    lexicalResource: number
    grammarAccuracy: number
  }
  criteriaAnalysis: {
    taskAchievement: string
    coherenceCohesion: string
    lexicalResource: string
    grammarAccuracy: string
  }
  corrections: Array<{
    original: string
    corrected: string
    reason: string
  }>
  improvedText: string
}

function buildPrompt(taskType: 'task1' | 'task2', title: string, promptText: string, content: string) {
  return `You are an expert IELTS Writing examiner. Evaluate the student's essay based on the official IELTS writing criteria.

TASK TYPE: ${taskType === 'task1' ? 'Task 1 (Report/Summary)' : 'Task 2 (Essay)'}
TITLE: ${title}
PROMPT:
${promptText}

STUDENT'S RESPONSE:
${content}

Provide a detailed evaluation with the following structure:
1. Overall Estimated Band Score (0-9, in 0.5 increments like 6.5)
2. Four Core Criteria Scores (0-9 each, in 0.5 increments):
   - Task Achievement / Response (TA/TR)
   - Coherence and Cohesion (CC)
   - Lexical Resource (LR)
   - Grammatical Range and Accuracy (GRA)
3. Detailed Criteria Analysis:
   - Analysis of TA/TR, CC, LR, and GRA, highlighting strengths and weaknesses.
4. Specific Corrections:
   - Provide a list of grammar/spelling corrections or vocabulary enhancements found in the text. For each correction, specify the original text, the corrected text, and the reason. Only highlight critical or noticeable errors.
5. Model/Improved Version:
   - Provide a short improved version of the student's response illustrating how they could elevate it to a higher band score (e.g., Band 8+).

Respond ONLY with valid JSON in this exact format, no extra text or markdown:
{
  "overallBand": 6.5,
  "scores": {
    "taskAchievement": 6.0,
    "coherenceCohesion": 7.0,
    "lexicalResource": 6.5,
    "grammarAccuracy": 6.5
  },
  "criteriaAnalysis": {
    "taskAchievement": "Analysis...",
    "coherenceCohesion": "Analysis...",
    "lexicalResource": "Analysis...",
    "grammarAccuracy": "Analysis..."
  },
  "corrections": [
    {
      "original": "original text",
      "corrected": "corrected text",
      "reason": "reason for correction"
    }
  ],
  "improvedText": "An improved version of the essay..."
}
`
}

export async function POST(req: NextRequest) {
  try {
    const gate = await gateAiRequest(req, 'ielts')
    if (gate.kind !== 'allow') return gate.response

    try {
      const body = await req.json()
      const { taskType, title, prompt, content } = body

      if (!taskType || !content || !content.trim()) {
        await refundIfFailed(gate.userId, 'ielts')
        return NextResponse.json({ error: 'Task type and content are required' }, { status: 400 })
      }

      const promptString = buildPrompt(taskType, title || '', prompt || '', content.trim())
      const evaluation = await aiClient.generateJSON<WritingEvaluationData>(promptString)

      return NextResponse.json(evaluation)
    } catch (error: unknown) {
      await refundIfFailed(gate.userId, 'ielts')
      console.error('IELTS writing evaluation error:', error)
      if (error instanceof AIClientError) {
        return NextResponse.json({ error: error.message }, { status: error.status || 500 })
      }
      const message = error instanceof Error ? error.message : 'Failed to evaluate IELTS writing'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('IELTS gate error:', error)
    const message = error instanceof Error ? error.message : 'Failed to initialize request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ielts/evaluate-writing' })
}
