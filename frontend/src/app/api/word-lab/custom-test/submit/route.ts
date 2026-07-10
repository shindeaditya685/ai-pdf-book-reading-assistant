import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { dateFrom, dateTo, questionType, words, results } = body
    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ success: false, error: 'Invalid results' })
    }

    const correct = results.filter((r: any) => r.correct).length
    const total = results.length
    const now = new Date()

    await conn.db.collection('word-lab-custom-tests').insertOne({
      username: user.username,
      dateFrom,
      dateTo,
      questionType,
      words,
      testResults: results,
      score: correct,
      total,
      completedAt: now.toISOString(),
      createdAt: now,
    })

    return NextResponse.json({ success: true, score: correct, total })
  } catch {
    return NextResponse.json({ success: false })
  }
}
