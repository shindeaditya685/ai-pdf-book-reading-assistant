import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pdfFileName = searchParams.get('pdfFileName')
  const pageNumber = searchParams.get('pageNumber')

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const filter: any = { username: user.username }
    if (pdfFileName) filter.pdfFileName = pdfFileName
    if (pageNumber) filter.pageNumber = parseInt(pageNumber, 10)
    const notes = await conn.db
      .collection('pageNotes')
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray()
    return NextResponse.json(notes)
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
    const { pageNumber, content, pdfFileName } = body

    if (!pdfFileName || pageNumber == null || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const doc = {
      pageNumber: Number(pageNumber),
      content: String(content).slice(0, 10000),
      pdfFileName,
      username: user.username,
      timestamp: new Date(),
      updatedAt: new Date(),
    }
    const result = await conn.db.collection('pageNotes').insertOne(doc)

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
    const { id, content } = body

    if (!id || content == null) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const { ObjectId } = await import('mongodb')
    await conn.db.collection('pageNotes').updateOne(
      { _id: new ObjectId(id), username: user.username },
      { $set: { content: String(content).slice(0, 10000), updatedAt: new Date() } }
    )

    return NextResponse.json({ success: true })
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

    if (!id) return NextResponse.json({ success: false }, { status: 400 })

    const { ObjectId } = await import('mongodb')
    await conn.db.collection('pageNotes').deleteOne({
      _id: new ObjectId(id),
      username: user.username,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
