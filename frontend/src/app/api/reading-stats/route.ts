import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ today: null, history: [], streak: 0 })

  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365)

    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    const records = await conn.db
      .collection('readingStats')
      .find({ username: user.username, date: { $gte: since.toISOString().slice(0, 10) } })
      .sort({ date: -1 })
      .toArray()

    const today = records.find((r) => r.date === todayStr()) || null

    // Compute streak (consecutive days with activity, ending today)
    let streak = 0
    const checkDate = new Date()
    while (true) {
      const ds = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
      const found = records.some((r) => r.date === ds)
      if (!found && streak === 0) {
        // If today has no activity, streak may start from yesterday
        checkDate.setDate(checkDate.getDate() - 1)
        continue
      }
      if (found) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return NextResponse.json({ today, history: records, streak })
  } catch {
    return NextResponse.json({ today: null, history: [], streak: 0 })
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { pagesRead = 0, timeSpentMs = 0 } = body
    const today = todayStr()

    const existing = await conn.db.collection('readingStats').findOne({
      username: user.username,
      date: today,
    })

    if (existing) {
      await conn.db.collection('readingStats').updateOne(
        { _id: existing._id },
        {
          $inc: { pagesRead, timeSpentMs, sessions: 1 },
          $set: { updatedAt: new Date() },
        }
      )
    } else {
      await conn.db.collection('readingStats').insertOne({
        username: user.username,
        date: today,
        pagesRead,
        timeSpentMs,
        sessions: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    const updated = await conn.db.collection('readingStats').findOne({
      username: user.username,
      date: today,
    })

    return NextResponse.json({ success: true, today: updated })
  } catch {
    return NextResponse.json({ success: false })
  }
}
