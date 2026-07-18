import { NextRequest, NextResponse } from 'next/server'
import { generateJSONWithFallback, FallbackError } from '@/lib/ai-fallback'

function buildPrompt(topic: string, difficulty: string) {
  const diffInstruction = difficulty === 'easy'
    ? 'Make it relatively straightforward — suitable for IELTS General Training or early Academic practice. Use simpler vocabulary and sentence structures.'
    : difficulty === 'hard'
      ? 'Make it challenging — suitable for Band 8-9 IELTS Academic candidates. Use complex vocabulary, sophisticated sentence structures, and abstract concepts.'
      : 'Make it moderate — suitable for Band 6-7 IELTS Academic candidates. Mix of straightforward and complex elements.'

  return `You are an expert IELTS test writer. Generate a complete IELTS Academic Reading passage with questions following the EXACT format below.

TOPIC: ${topic}
DIFFICULTY: ${difficulty}
${diffInstruction}

## STRICT FORMAT RULES

The passage must include ALL of the following question types (at least one of each):
1. **Multiple Choice Questions (MCQ)** — 2 questions with 4 options each (A, B, C, D)
2. **True/False/Not Given** — 2 statements
3. **Matching Headings** — 2 paragraphs with heading options (provide 4 heading options + 1 extra)
4. **Sentence Completion** — 1 fill-in-the-blank (1-2 words from the passage)

## PASSAGE REQUIREMENTS
- Title must be an academic-style heading
- 600-800 words
- 5-6 paragraphs
- Academic topic suitable for IELTS (science, history, geography, psychology, environment, technology, sociology, economics, health, archaeology, etc.)
- Each paragraph should be 2-5 sentences
- The passage must be self-contained and make sense without external knowledge
- Use formal academic English

## QUESTION REQUIREMENTS
- Questions must test real reading comprehension, not trivial fact retrieval
- Answers must be EXACTLY as they appear in the passage (for completion) or clearly supported by the text
- T/F/NG questions must use accurate IELTS logic
- Matching Headings must have distinguishable options — avoid vague or overlapping headings
- MCQ distractors must be plausible but incorrect

Respond ONLY with valid JSON in this exact format, no extra text or markdown:
{
  "id": "ai-generated-1",
  "title": "Passage Title Here",
  "difficulty": "${difficulty}",
  "wordCount": 700,
  "text": "Full passage text with paragraphs separated by double newlines...",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Explanation of why this is correct with reference to the passage."
    },
    {
      "id": 2,
      "type": "mcq",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option B",
      "explanation": "Explanation..."
    },
    {
      "id": 3,
      "type": "tfng",
      "question": "Statement that is True, False, or Not Given.",
      "answer": "True",
      "explanation": "Explanation..."
    },
    {
      "id": 4,
      "type": "tfng",
      "question": "Another statement.",
      "answer": "False",
      "explanation": "Explanation..."
    },
    {
      "id": 5,
      "type": "heading",
      "question": "Choose the correct heading for paragraph 2.",
      "options": ["Heading A description", "Heading B description", "Heading C description", "Heading D description", "Heading E description"],
      "answer": "Heading A description",
      "explanation": "Explanation..."
    },
    {
      "id": 6,
      "type": "heading",
      "question": "Choose the correct heading for paragraph 4.",
      "options": ["Heading A description", "Heading B description", "Heading C description", "Heading D description", "Heading E description"],
      "answer": "Heading C description",
      "explanation": "Explanation..."
    },
    {
      "id": 7,
      "type": "completion",
      "question": "Complete the sentence using NO MORE THAN TWO WORDS from the passage: The __________ were significantly affected by the development.",
      "answer": "key words here",
      "explanation": "Explanation..."
    }
  ]
}

IMPORTANT: 
- The heading options for BOTH heading questions must be the SAME set of 5 options (the extra one is a distractor).
- For T/F/NG, ensure proper IELTS logic: "True" if the statement matches the passage, "False" if it contradicts, "Not Given" if there's no information.
- For the completion question, the blank must be 1-2 words that appear EXACTLY in the passage.
- The entire response must be valid JSON only. No markdown, no code fences.`
}

function validatePassage(data: any): boolean {
  if (!data || typeof data.title !== 'string' || !data.text || !Array.isArray(data.questions)) return false
  if (data.questions.length < 7) return false
  const types = new Set(data.questions.map((q: any) => q.type))
  if (!types.has('mcq') || !types.has('tfng') || !types.has('heading') || !types.has('completion')) return false
  return true
}

interface PassageData {
  title: string
  text: string
  wordCount?: number
  difficulty: string
  questions: unknown[]
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { topic, difficulty = 'medium' } = body

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: 'A topic is required' }, { status: 400 })
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'Difficulty must be easy, medium, or hard' }, { status: 400 })
    }

    const prompt = buildPrompt(topic.trim(), difficulty)
    const passage = await generateJSONWithFallback<PassageData>(prompt)

    if (!validatePassage(passage)) {
      return NextResponse.json({ error: 'AI returned invalid format. Please try a different topic.' }, { status: 500 })
    }

    return NextResponse.json(passage)
  } catch (error: unknown) {
    console.error('IELTS passage generation error:', error)
    if (error instanceof FallbackError) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    const message = error instanceof Error ? error.message : 'Failed to generate IELTS passage'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ielts/generate-passage' })
}
