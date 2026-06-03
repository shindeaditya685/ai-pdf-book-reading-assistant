import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const flashcards = await conn.db
      .collection('sharedFlashcards')
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .toArray()
    return NextResponse.json(flashcards)
  } catch (error) {
    console.error('[API Shared Flashcards Get] Error:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const body = await request.json()
    const { id, sessionId, word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName } = body

    if (!sessionId || !word) {
      return NextResponse.json({ error: 'sessionId and word required' }, { status: 400 })
    }

    const doc = {
      flashcardId: id || `fc-${Date.now()}`,
      sessionId,
      word,
      meaning: meaning || '',
      pronunciation: pronunciation || '',
      translation: translation || '',
      sentence: sentence || '',
      pageNumber: Number(pageNumber) || 0,
      pdfFileName: pdfFileName || '',
      author: user.username,
      createdAt: new Date().toISOString(),
    }

    await conn.db.collection('sharedFlashcards').updateOne(
      { flashcardId: doc.flashcardId, sessionId },
      { $set: doc as any },
      { upsert: true }
    )

    return NextResponse.json(doc)
  } catch (error) {
    console.error('[API Shared Flashcards Post] Error:', error)
    return NextResponse.json({ error: 'Failed to save flashcard' }, { status: 500 })
  }
}
