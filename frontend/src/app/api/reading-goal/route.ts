import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ enabled: false, pages: 0, minutes: 0 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ enabled: false, pages: 0, minutes: 0 })

  try {
    const goal = await conn.db.collection('readingGoals').findOne({ username: user.username })
    return NextResponse.json(
      goal || { enabled: false, pages: 10, minutes: 30 }
    )
  } catch {
    return NextResponse.json({ enabled: false, pages: 0, minutes: 0 })
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { enabled, pages, minutes } = body

    await conn.db.collection('readingGoals').updateOne(
      { username: user.username },
      {
        $set: {
          enabled: enabled ?? false,
          pages: pages ?? 0,
          minutes: minutes ?? 0,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
