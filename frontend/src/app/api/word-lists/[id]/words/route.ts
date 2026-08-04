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
    const existing = await conn.db.collection('word-lists').findOne({ _id: new ObjectId(id) })
    if (!existing || existing.username !== user.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { word, meaning, pronunciation, translation, example, partOfSpeech } = await request.json()
    if (!word || !word.trim()) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    const normalizedWord = word.trim().toLowerCase()

    const wordExists = (existing.words || []).some((w: any) => w.word.toLowerCase() === normalizedWord)
    if (wordExists) {
      return NextResponse.json({ error: 'Word already exists in this list' }, { status: 400 })
    }

    const entry = {
      word: normalizedWord,
      meaning: meaning?.trim() || '',
      pronunciation: pronunciation?.trim() || '',
      translation: translation?.trim() || '',
      example: example?.trim() || '',
      partOfSpeech: partOfSpeech?.trim() || '',
      addedAt: new Date(),
    }

    await conn.db.collection('word-lists').updateOne(
      { _id: new ObjectId(id) },
      { $push: { words: entry } as any, $set: { updatedAt: new Date() } }
    )

    return NextResponse.json({ success: true, entry })
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

    const { searchParams } = new URL(request.url)
    const word = searchParams.get('word')
    if (!word) {
      return NextResponse.json({ error: 'Word query param required' }, { status: 400 })
    }

    await conn.db.collection('word-lists').updateOne(
      { _id: new ObjectId(id) },
      { $pull: { words: { word: word.trim().toLowerCase() } } as any, $set: { updatedAt: new Date() } }
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
