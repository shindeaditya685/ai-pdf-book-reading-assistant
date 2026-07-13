import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ lists: [], subscribed: [] })

  try {
    const own = await conn.db.collection('word-lists')
      .find({ username: user.username })
      .sort({ updatedAt: -1 })
      .toArray()

    const subs = await conn.db.collection('word-list-subscriptions')
      .find({ username: user.username })
      .toArray()
    const subIds = subs.map((s) => s.listId.toString())

    const subscribed = subIds.length > 0
      ? await conn.db.collection('word-lists')
          .find({ _id: { $in: subIds.map((id) => new ObjectId(id)) } })
          .sort({ updatedAt: -1 })
          .toArray()
      : []

    const publicLists = await conn.db.collection('word-lists')
      .find({ username: { $ne: user.username }, isPublic: true })
      .sort({ subscriberCount: -1 })
      .limit(20)
      .toArray()

    return NextResponse.json({
      lists: own.map(serialize),
      subscribed: subscribed.map(serialize),
      discover: publicLists.map(serialize),
    })
  } catch {
    return NextResponse.json({ lists: [], subscribed: [], discover: [] })
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const { name, description, isPublic } = await request.json()
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' })
    }

    const doc = {
      username: user.username,
      name: name.trim(),
      description: description?.trim() || '',
      isPublic: !!isPublic,
      words: [],
      subscriberCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await conn.db.collection('word-lists').insertOne(doc)
    return NextResponse.json({ success: true, list: serialize({ ...doc, _id: result.insertedId }) })
  } catch {
    return NextResponse.json({ success: false })
  }
}

function serialize(doc: any) {
  return {
    _id: doc._id.toString(),
    username: doc.username,
    name: doc.name,
    description: doc.description,
    isPublic: doc.isPublic,
    words: (doc.words || []).map((w: any) => ({
      ...w,
      addedAt: w.addedAt?.toISOString?.() || w.addedAt,
    })),
    subscriberCount: doc.subscriberCount || 0,
    createdAt: doc.createdAt?.toISOString?.() || doc.createdAt,
    updatedAt: doc.updatedAt?.toISOString?.() || doc.updatedAt,
  }
}
