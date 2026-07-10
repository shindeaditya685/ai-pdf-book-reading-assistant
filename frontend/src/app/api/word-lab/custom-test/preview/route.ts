import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { dateFrom, dateTo } = body
    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ words: [], sessionCount: 0, wordCount: 0 })

    const sessions = await conn.db.collection('word-lab')
      .find({
        username: user.username,
        date: { $gte: dateFrom, $lte: dateTo },
        completedAt: { $ne: null },
      })
      .project({ words: 1, date: 1 })
      .sort({ date: 1 })
      .toArray()

    const seen = new Set<string>()
    const words: any[] = []
    for (const s of sessions) {
      for (const w of (s.words || [])) {
        if (!seen.has(w.id)) {
          seen.add(w.id)
          words.push({ ...w, sessionDate: s.date })
        }
      }
    }

    return NextResponse.json({ words, sessionCount: sessions.length, wordCount: words.length })
  } catch {
    return NextResponse.json({ words: [], sessionCount: 0, wordCount: 0 })
  }
}
