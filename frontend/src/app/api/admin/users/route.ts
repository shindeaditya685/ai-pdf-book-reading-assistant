import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { isUnlimitedPlan, normalizeAIPlan, type AIPlan } from '@/lib/ai-plan'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const db = conn.db
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray()

    const enriched = await Promise.all(users.map(async (u) => {
      const [pdfCount, bookmarksCount, historyCount, annotationsCount] = await Promise.all([
        db.collection('pdfs').countDocuments({ username: u.username }),
        db.collection('bookmarks').countDocuments({ username: u.username }),
        db.collection('wordHistory').countDocuments({ username: u.username }),
        db.collection('annotations').countDocuments({ username: u.username }),
      ])
      const plan: AIPlan = normalizeAIPlan(u.plan)
      return {
        _id: u._id.toString(),
        username: u.username,
        isAdmin: !!u.isAdmin,
        plan,
        isUnlimited: isUnlimitedPlan(plan),
        aiUsage: u.aiUsage ?? null,
        createdAt: u.createdAt,
        stats: { pdfs: pdfCount, bookmarks: bookmarksCount, words: historyCount, annotations: annotationsCount },
      }
    }))

    return NextResponse.json({ users: enriched })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { userId, makeAdmin } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    let objectId: ObjectId
    try { objectId = new ObjectId(userId) } catch { return NextResponse.json({ error: 'Invalid userId' }, { status: 400 }) }

    const user = await conn.db.collection('users').findOne({ _id: objectId })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (user.username === admin.username && makeAdmin === false) {
      return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 })
    }

    await conn.db.collection('users').updateOne({ _id: objectId }, { $set: { isAdmin: makeAdmin !== false } })

    return NextResponse.json({ success: true, username: user.username, isAdmin: makeAdmin !== false })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
