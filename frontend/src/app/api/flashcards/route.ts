import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

const DEFAULT_EF = 2.5
const DEFAULT_INTERVAL = 0
const DEFAULT_REPETITIONS = 0

function getNextReview(
  grade: number,
  ef: number,
  interval: number,
  repetitions: number
): { ef: number; interval: number; repetitions: number; nextReview: Date } {
  let newEf = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  if (newEf < 1.3) newEf = 1.3

  let newInterval: number
  let newRepetitions: number

  if (grade < 3) {
    newInterval = 1
    newRepetitions = 0
  } else {
    newRepetitions = repetitions + 1
    if (newRepetitions === 1) {
      newInterval = 1
    } else if (newRepetitions === 2) {
      newInterval = 6
    } else {
      newInterval = Math.round(interval * newEf)
    }
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + newInterval)
  nextReview.setHours(0, 0, 0, 0)

  return { ef: newEf, interval: newInterval, repetitions: newRepetitions, nextReview }
}

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
      const { word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName, bookmarkId } = body
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
      const doc = {
        bookmarkId: bookmarkId || '',
        word,
        meaning: meaning || '',
        pronunciation: pronunciation || '',
        translation: translation || '',
        sentence: sentence || '',
        pageNumber: pageNumber || 0,
        pdfFileName,
        username: user.username,
        ef: DEFAULT_EF,
        interval: DEFAULT_INTERVAL,
        repetitions: DEFAULT_REPETITIONS,
        nextReview: now,
        lastReview: null,
        totalReviews: 0,
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

      const { ef, interval, repetitions, nextReview } = getNextReview(
        grade,
        card.ef || DEFAULT_EF,
        card.interval || DEFAULT_INTERVAL,
        card.repetitions || DEFAULT_REPETITIONS
      )

      const now = new Date()
      await conn.db.collection('flashcards').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ef,
            interval,
            repetitions,
            nextReview,
            lastReview: now,
            updatedAt: now,
          },
          $inc: { totalReviews: 1 },
        }
      )

      return NextResponse.json({
        success: true,
        ef,
        interval,
        repetitions,
        nextReview,
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
    if (!id) return NextResponse.json({ success: false })

    const { ObjectId } = await import('mongodb')
    await conn.db.collection('flashcards').deleteOne({ _id: new ObjectId(id), username: user.username })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
