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
    const history = await conn.db
      .collection('wordHistory')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(pdfFileName ? 100 : 10000)
      .toArray()
    return NextResponse.json(history)
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
    const { word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName } = body
    if (!word || !pdfFileName) return NextResponse.json({ success: false })

    // Reject multi-word phrases saved as "words"
    if (/\s/.test(word) || word.length > 50) {
      return NextResponse.json({ success: false, error: 'word must be a single word' }, { status: 400 })
    }

    const doc = {
      word: word.toLowerCase(),
      meaning: meaning || '',
      pronunciation: pronunciation || '',
      translation: translation || '',
      sentence: sentence || '',
      pageNumber: pageNumber || 0,
      pdfFileName,
      username: user.username,
      timestamp: new Date(),
    }
    const result = await conn.db.collection('wordHistory').insertOne(doc)
    return NextResponse.json({ id: result.insertedId.toString(), success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
