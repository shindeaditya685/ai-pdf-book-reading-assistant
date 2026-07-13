import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getNextReview, newCardDefaults } from '@/lib/fsrs'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const { searchParams } = new URL(request.url)
    const dueOnly = searchParams.get('dueOnly') === 'true'
    const now = new Date()

    const filter: any = { username: user.username, source: 'word-lab' }
    if (dueOnly) filter.nextReview = { $lte: now }

    const cards = await conn.db
      .collection('word-lab-flashcards')
      .find(filter)
      .sort({ nextReview: 1 })
      .toArray()

    return NextResponse.json(cards)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const { words } = body
      if (!words || !Array.isArray(words) || words.length === 0) {
        return NextResponse.json({ success: false, error: 'Words array required' })
      }

      const now = new Date()
      const defaults = newCardDefaults()
      const docs = words.map((w: any) => ({
        username: user.username,
        source: 'word-lab',
        wordId: w.id,
        word: w.word,
        pronunciation: w.pronunciation || '',
        meaning: w.meaning || '',
        translation: w.translation || '',
        example: w.example || '',
        sessionDate: w.sessionDate || '',
        ...defaults,
        createdAt: now,
        updatedAt: now,
      }))

      await conn.db.collection('word-lab-flashcards').insertMany(docs)
      return NextResponse.json({ success: true, count: docs.length })
    }

    if (action === 'review') {
      const { cardId, grade } = body
      if (!cardId || grade === undefined) {
        return NextResponse.json({ success: false, error: 'cardId and grade required' })
      }

      const card = await conn.db.collection('word-lab-flashcards').findOne({
        _id: new (require('mongodb').ObjectId)(cardId),
        username: user.username,
      })
      if (!card) {
        return NextResponse.json({ success: false, error: 'Card not found' })
      }

      const result = getNextReview(grade, {
        stability: card.stability || 0,
        difficulty: card.difficulty || 4.93,
      })

      await conn.db.collection('word-lab-flashcards').updateOne(
        { _id: card._id },
        {
          $set: {
            stability: result.stability,
            difficulty: result.difficulty,
            interval: result.interval,
            nextReview: result.nextReview,
            lastReview: new Date(),
            updatedAt: new Date(),
          },
          $inc: { totalReviews: 1 },
        }
      )

      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' })
  }
}

export async function DELETE(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' })

    const { ObjectId } = await import('mongodb')
    await conn.db.collection('word-lab-flashcards').deleteOne({
      _id: new ObjectId(id),
      username: user.username,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
