import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ items: [] })

  try {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    const items = await conn.db.collection('word-lab-review')
      .find({ username: user.username, nextReview: { $lte: today } })
      .sort({ nextReview: 1 })
      .toArray()

    return NextResponse.json({
      items: items.map((i) => ({
        id: i._id.toString(),
        wordId: i.wordId,
        word: i.word,
        pronunciation: i.pronunciation || '',
        meaning: i.meaning || '',
        translation: i.translation || '',
        example: i.example || '',
        interval: i.interval || 1,
        correctCount: i.correctCount || 0,
        wrongCount: i.wrongCount || 0,
      })),
    })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { results } = body
    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ success: false, error: 'Invalid results' })
    }

    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    for (const r of results) {
      const existing = await conn.db.collection('word-lab-review').findOne({
        username: user.username,
        wordId: r.wordId,
      })

      if (!existing && !r.correct) {
        // First time missed — add to review queue
        await conn.db.collection('word-lab-review').insertOne({
          username: user.username,
          wordId: r.wordId,
          word: r.word,
          pronunciation: r.pronunciation || '',
          meaning: r.meaning || '',
          translation: r.translation || '',
          example: r.example || '',
          interval: 1,
          nextReview: today,
          correctCount: 0,
          wrongCount: 1,
          lastWrong: now.toISOString(),
          createdAt: now,
          updatedAt: now,
        })
      } else if (existing) {
        const interval = existing.interval || 1
        const wrongCount = existing.wrongCount || 0
        const correctCount = existing.correctCount || 0

        if (r.correct) {
          const nextInterval = Math.min(interval * 2, 30)
          const nextDate = new Date(now)
          nextDate.setDate(nextDate.getDate() + nextInterval)
          await conn.db.collection('word-lab-review').updateOne(
            { _id: existing._id },
            {
              $set: {
                interval: nextInterval,
                nextReview: nextDate.toISOString().slice(0, 10),
                correctCount: correctCount + 1,
                updatedAt: now,
                lastReview: now.toISOString(),
                pronunciation: r.pronunciation || existing.pronunciation || '',
                meaning: r.meaning || existing.meaning || '',
                translation: r.translation || existing.translation || '',
                example: r.example || existing.example || '',
              },
            }
          )
        } else {
          // Wrong — reset interval to 1
          await conn.db.collection('word-lab-review').updateOne(
            { _id: existing._id },
            {
              $set: {
                interval: 1,
                nextReview: today,
                wrongCount: wrongCount + 1,
                updatedAt: now,
                lastWrong: now.toISOString(),
              },
            }
          )
        }
      }
    }

    // Return updated review counts
    const dueCount = await conn.db.collection('word-lab-review').countDocuments({
      username: user.username,
      nextReview: { $lte: today },
    })

    return NextResponse.json({ success: true, dueCount })
  } catch {
    return NextResponse.json({ success: false })
  }
}
