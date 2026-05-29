import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('fileName')

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    if (fileName) {
      const pdf = await conn.db.collection('pdfs').findOne({ fileName })
      if (!pdf) return NextResponse.json(null)
      return NextResponse.json(pdf)
    }

    const pdfs = await conn.db
      .collection('pdfs')
      .find({}, { projection: { content: 0 } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray()
    return NextResponse.json(pdfs)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { fileName, content, pageCount } = body
    if (!fileName || !content) return NextResponse.json({ success: false })

    const existing = await conn.db.collection('pdfs').findOne({ fileName })
    if (existing) {
      await conn.db.collection('pdfs').updateOne(
        { _id: existing._id },
        { $set: { content, pageCount: pageCount || 0, updatedAt: new Date() } }
      )
      return NextResponse.json({ id: existing._id, success: true })
    }

    const result = await conn.db.collection('pdfs').insertOne({
      fileName,
      content,
      pageCount: pageCount || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return NextResponse.json({ id: result.insertedId.toString(), success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
