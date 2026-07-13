import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ collections: [] })

  try {
    const collections = await conn.db.collection('collections')
      .find({ username: user.username })
      .sort({ updatedAt: -1 })
      .project({ words: 0 })
      .toArray()

    return NextResponse.json({ collections })
  } catch {
    return NextResponse.json({ collections: [] })
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const now = new Date()
    const doc = {
      username: user.username,
      name: name.trim(),
      description: description?.trim() || '',
      words: [],
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    const result = await conn.db.collection('collections').insertOne(doc)

    return NextResponse.json({
      success: true,
      collection: { ...doc, _id: result.insertedId.toString() },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }
}
