import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pdfFileName = searchParams.get('pdfFileName')
  if (!pdfFileName) return NextResponse.json([])

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const history = await conn.db
      .collection('wordHistory')
      .find({ pdfFileName })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()
    return NextResponse.json(history)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName } = body
    if (!word || !pdfFileName) return NextResponse.json({ success: false })

    const doc = {
      word,
      meaning: meaning || '',
      pronunciation: pronunciation || '',
      translation: translation || '',
      sentence: sentence || '',
      pageNumber: pageNumber || 0,
      pdfFileName,
      timestamp: new Date(),
    }
    const result = await conn.db.collection('wordHistory').insertOne(doc)
    return NextResponse.json({ id: result.insertedId.toString(), success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
