import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' })

  try {
    const { ObjectId } = await import('mongodb')
    const doc = await conn.db.collection('word-lists').findOne({ _id: new ObjectId(id) })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isOwner = doc.username === user.username
    const isSubscribed = !isOwner
      ? !!(await conn.db.collection('word-list-subscriptions').findOne({ listId: id, username: user.username }))
      : false

    if (!doc.isPublic && !isOwner && !isSubscribed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ ...serialize(doc), isOwner, isSubscribed })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const { ObjectId } = await import('mongodb')
    const existing = await conn.db.collection('word-lists').findOne({ _id: new ObjectId(id) })
    if (!existing || existing.username !== user.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, description, isPublic } = await request.json()
    const update: Record<string, unknown> = { updatedAt: new Date() }
    if (name !== undefined) update.name = name.trim()
    if (description !== undefined) update.description = description.trim()
    if (isPublic !== undefined) update.isPublic = !!isPublic

    await conn.db.collection('word-lists').updateOne({ _id: new ObjectId(id) }, { $set: update } as any)
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
    const existing = await conn.db.collection('word-lists').findOne({ _id: new ObjectId(id) })
    if (!existing || existing.username !== user.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await conn.db.collection('word-lists').deleteOne({ _id: new ObjectId(id) })
    await conn.db.collection('word-list-subscriptions').deleteMany({ listId: id })
    return NextResponse.json({ success: true })
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
