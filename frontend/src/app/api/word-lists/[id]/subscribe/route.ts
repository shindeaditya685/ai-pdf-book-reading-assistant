import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const { ObjectId } = await import('mongodb')
    const list = await conn.db.collection('word-lists').findOne({ _id: new ObjectId(id) })
    if (!list || !list.isPublic) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (list.username === user.username) {
      return NextResponse.json({ success: true })
    }

    const existing = await conn.db.collection('word-list-subscriptions').findOne({
      listId: id,
      username: user.username,
    })
    if (existing) return NextResponse.json({ success: true })

    await conn.db.collection('word-list-subscriptions').insertOne({
      listId: id,
      username: user.username,
      subscribedAt: new Date(),
    })
    await conn.db.collection('word-lists').updateOne(
      { _id: new ObjectId(id) },
      { $inc: { subscriberCount: 1 } }
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const { ObjectId } = await import('mongodb')
    const list = await conn.db.collection('word-lists').findOne({ _id: new ObjectId(id) })
    if (!list) return NextResponse.json({ success: true })

    await conn.db.collection('word-list-subscriptions').deleteMany({
      listId: id,
      username: user.username,
    })
    if (list.isPublic) {
      await conn.db.collection('word-lists').updateOne(
        { _id: new ObjectId(id) },
        { $inc: { subscriberCount: -1 } }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
