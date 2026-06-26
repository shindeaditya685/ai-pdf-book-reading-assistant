import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { wordId } = body
    if (!wordId) {
      return NextResponse.json({ success: false, error: 'Missing wordId' })
    }

    const result = await conn.db.collection('word-lab').updateOne(
      { username: user.username, date: todayStr() },
      { $addToSet: { studiedIds: wordId }, $set: { updatedAt: new Date() } }
    )

    return NextResponse.json({ success: result.modifiedCount > 0 })
  } catch {
    return NextResponse.json({ success: false })
  }
}
