import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch {
      return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
    }

    const body = await request.json()
    const { words } = body

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words array is required' }, { status: 400 })
    }

    // Verify ownership
    const collection = await conn.db.collection('collections').findOne(
      { _id: objectId, username: user.username },
      { projection: { words: 1, wordCount: 1 } },
    )
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const now = new Date()
    const lastOrder = collection.words?.length || 0

    const newWords = words.map((w: any, i: number) => ({
      word: String(w.word || '').trim().toLowerCase(),
      meaning: w.meaning || '',
      pronunciation: w.pronunciation || '',
      translation: w.translation || null,
      partOfSpeech: w.partOfSpeech || '',
      example: w.example || '',
      order: lastOrder + i,
      createdAt: now,
    })).filter((w: { word: string }) => w.word)

    if (newWords.length === 0) {
      return NextResponse.json({ error: 'No valid words provided' }, { status: 400 })
    }

    await conn.db.collection('collections').updateOne(
      { _id: objectId },
      {
        $push: { words: { $each: newWords } } as any,
        $inc: { wordCount: newWords.length },
        $set: { updatedAt: now },
      },
    )

    return NextResponse.json({ success: true, added: newWords.length })
  } catch {
    return NextResponse.json({ error: 'Failed to add words' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch {
      return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
    }

    const body = await request.json()
    const { word } = body

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    const result = await conn.db.collection('collections').updateOne(
      { _id: objectId, username: user.username },
      {
        $pull: { words: { word: word.trim().toLowerCase() } } as any,
        $inc: { wordCount: -1 },
        $set: { updatedAt: new Date() },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove word' }, { status: 500 })
  }
}
