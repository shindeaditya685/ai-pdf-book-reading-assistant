import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pdfFileName = searchParams.get('pdfFileName')

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const filter: any = { username: user.username }
    if (pdfFileName) filter.pdfFileName = pdfFileName
    const bookmarks = await conn.db
      .collection('bookmarks')
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray()
    return NextResponse.json(bookmarks)
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
    const { word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName, partOfSpeech, example } = body

    if (!word || !pdfFileName) {
      return NextResponse.json({ success: false })
    }

    // Allow single words AND multi-word phrases (removed single-word
    // restriction so users can bookmark selected phrases/lines).
    if (word.length > 200) {
      return NextResponse.json({ success: false, error: 'word too long' }, { status: 400 })
    }

    const doc = {
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
      timestamp: new Date(),
    }
    const result = await conn.db.collection('bookmarks').insertOne(doc)

    return NextResponse.json({ id: result.insertedId.toString(), success: true })
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
    await conn.db.collection('bookmarks').deleteOne({ _id: new ObjectId(id), username: user.username })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
