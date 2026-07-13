import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getNextReview, migrateFromSM2, newCardDefaults } from '@/lib/fsrs'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const { searchParams } = new URL(request.url)
    const pdfFileName = searchParams.get('pdfFileName')
    const dueOnly = searchParams.get('dueOnly') === 'true'
    const now = new Date()

    const filter: any = { username: user.username }
    if (pdfFileName) filter.pdfFileName = pdfFileName
    if (dueOnly) filter.nextReview = { $lte: now }

    const flashcards = await conn.db
      .collection('flashcards')
      .find(filter)
      .sort({ nextReview: 1 })
      .toArray()

    return NextResponse.json(flashcards)
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
      const { word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName, bookmarkId, partOfSpeech, example } = body
      if (!word || !pdfFileName) {
        return NextResponse.json({ success: false, error: 'Missing required fields' })
      }

      const existing = await conn.db.collection('flashcards').findOne({
        username: user.username,
        pdfFileName,
        word,
      })
      if (existing) {
        return NextResponse.json({ success: false, error: 'Flashcard already exists' })
      }

      const now = new Date()
      const defaults = newCardDefaults()
      const doc = {
        bookmarkId: bookmarkId || '',
        word,
        meaning: meaning || '',
        pronunciation: pronunciation || '',
        translation: translation || '',
        sentence: sentence || '',
        pageNumber: pageNumber || 0,
        pdfFileName,
        partOfSpeech: partOfSpeech || '',
        example: example || '',
        username: user.username,
        ef: defaults.ef,
        stability: defaults.stability,
        difficulty: defaults.difficulty,
        interval: defaults.interval,
        repetitions: defaults.repetitions,
        nextReview: defaults.nextReview,
        lastReview: defaults.lastReview,
        totalReviews: defaults.totalReviews,
        createdAt: now,
        updatedAt: now,
      }
      const result = await conn.db.collection('flashcards').insertOne(doc)
      return NextResponse.json({ id: result.insertedId.toString(), success: true })
    }

    if (action === 'review') {
      const { id, grade } = body
      if (!id || grade === undefined || grade < 0 || grade > 5) {
        return NextResponse.json({ success: false, error: 'Invalid review data' })
      }

      const { ObjectId } = await import('mongodb')
      const card = await conn.db.collection('flashcards').findOne({
        _id: new ObjectId(id),
        username: user.username,
      })
      if (!card) {
        return NextResponse.json({ success: false, error: 'Flashcard not found' })
      }

      const now = new Date()
      const migrated = migrateFromSM2(card as unknown as { ef?: number; interval?: number; repetitions?: number; stability?: number; difficulty?: number })
      const result = getNextReview(grade, migrated)

      await conn.db.collection('flashcards').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            stability: result.stability,
            difficulty: result.difficulty,
            interval: result.interval,
            nextReview: result.nextReview,
            lastReview: now,
            updatedAt: now,
          },
          $inc: { totalReviews: 1 },
        }
      )

      return NextResponse.json({
        success: true,
        stability: result.stability,
        difficulty: result.difficulty,
        interval: result.interval,
        nextReview: result.nextReview,
        totalReviews: (card.totalReviews || 0) + 1,
      })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' })
  } catch {
    return NextResponse.json({ success: false })
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
    const word = searchParams.get('word')
    const pdfFileName = searchParams.get('pdfFileName')

    let filter: any = { username: user.username }
    if (id) {
      const { ObjectId } = await import('mongodb')
      filter._id = new ObjectId(id)
    } else if (word && pdfFileName) {
      filter.word = word
      filter.pdfFileName = pdfFileName
    } else {
      return NextResponse.json({ success: false })
    }

    await conn.db.collection('flashcards').deleteOne(filter)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
