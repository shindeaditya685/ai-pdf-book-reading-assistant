import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('fileName')

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    if (fileName) {
      const pdf = await conn.db.collection('pdfs').findOne({ fileName, username: user.username })
      if (!pdf) return NextResponse.json(null)
      return NextResponse.json(pdf)
    }

    const pdfs = await conn.db
      .collection('pdfs')
      .find({ username: user.username }, { projection: { content: 0 } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray()
    return NextResponse.json(pdfs)
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
    const { fileName, content, pageCount } = body
    if (!fileName || !content) return NextResponse.json({ success: false })

    const existing = await conn.db.collection('pdfs').findOne({ fileName, username: user.username })
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
      username: user.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return NextResponse.json({ id: result.insertedId.toString(), success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}

export async function PATCH(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { fileName, ocrText } = body
    if (!fileName) return NextResponse.json({ success: false })

    const existing = await conn.db.collection('pdfs').findOne({ fileName, username: user.username })
    if (!existing) return NextResponse.json({ success: false })

    await conn.db.collection('pdfs').updateOne(
      { _id: existing._id },
      { $set: { ocrText: ocrText || {}, updatedAt: new Date() } }
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
