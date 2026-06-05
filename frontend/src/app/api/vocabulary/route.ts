import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ words: [], totalWords: 0, totalBooks: 0 })

  try {
    const { searchParams } = new URL(request.url)
    const pdfFileName = searchParams.get('pdfFileName')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'freq'
    const order = searchParams.get('order') || 'desc'

    const match: any = { username: user.username }
    if (pdfFileName) match.pdfFileName = pdfFileName
    if (search) match.word = { $regex: search, $options: 'i' }

    const pipeline: any[] = [
      { $match: match },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$word',
          frequency: { $sum: 1 },
          meaning: { $first: '$meaning' },
          pronunciation: { $first: '$pronunciation' },
          translation: { $first: '$translation' },
          sentence: { $first: '$sentence' },
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' },
          pdfs: { $addToSet: '$pdfFileName' },
        },
      },
      {
        $project: {
          _id: 0,
          word: '$_id',
          frequency: 1,
          meaning: 1,
          pronunciation: 1,
          translation: 1,
          sentence: 1,
          firstSeen: 1,
          lastSeen: 1,
          pdfs: 1,
        },
      },
    ]

    const sortDir = order === 'asc' ? 1 : -1
    if (sort === 'freq') pipeline.push({ $sort: { frequency: sortDir, word: 1 } })
    else if (sort === 'alpha') pipeline.push({ $sort: { word: sortDir } })
    else pipeline.push({ $sort: { lastSeen: sortDir, word: 1 } })

    const words = await conn.db.collection('wordHistory').aggregate(pipeline).toArray()

    const pdfs = await conn.db.collection('wordHistory').distinct('pdfFileName', { username: user.username })

    return NextResponse.json({ words, totalWords: words.length, totalBooks: pdfs.length, pdfs })
  } catch {
    return NextResponse.json({ words: [], totalWords: 0, totalBooks: 0, pdfs: [] })
  }
}

export async function DELETE(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const word = searchParams.get('word')
  if (!word) return NextResponse.json({ error: 'word required' }, { status: 400 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const result = await conn.db.collection('wordHistory').deleteMany({ username: user.username, word })
    return NextResponse.json({ success: true, deletedCount: result.deletedCount })
  } catch {
    return NextResponse.json({ success: false })
  }
}
