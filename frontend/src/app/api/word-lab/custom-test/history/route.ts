import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ tests: [] })

  try {
    const tests = await conn.db.collection('word-lab-custom-tests')
      .find({ username: user.username })
      .project({
        dateFrom: 1,
        dateTo: 1,
        questionType: 1,
        words: 1,
        score: 1,
        total: 1,
        completedAt: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .toArray()

    const mapped = tests.map((t: any) => ({
      ...t,
      _id: t._id.toString(),
    }))

    return NextResponse.json({ tests: mapped })
  } catch {
    return NextResponse.json({ tests: [] })
  }
}
