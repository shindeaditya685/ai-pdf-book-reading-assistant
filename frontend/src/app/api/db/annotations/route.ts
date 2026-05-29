import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pdfFileName = searchParams.get('pdfFileName')
  if (!pdfFileName) {
    return NextResponse.json([])
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const annotations = await conn.db
      .collection('annotations')
      .find({ pdfFileName, username: user.username })
      .toArray()
    return NextResponse.json(annotations)
  } catch (error) {
    console.error('[API GET Annotations] Error:', error)
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
    const { id, type, pageNumber, color, rects, points, thickness, noteText, x, y, pdfFileName } = body

    if (!pdfFileName || !id) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' })
    }

    const doc = {
      annotationId: id,
      type,
      pageNumber: Number(pageNumber) || 0,
      color: color || '',
      rects: rects || [],
      points: points || [],
      thickness: Number(thickness) || 0,
      noteText: noteText || '',
      x: Number(x) || 0,
      y: Number(y) || 0,
      pdfFileName,
      username: user.username,
      timestamp: new Date(),
    }

    // Upsert annotation based on client ID and username
    await conn.db.collection('annotations').updateOne(
      { annotationId: id, username: user.username },
      { $set: doc },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API POST Annotations] Error:', error)
    return NextResponse.json({ success: false, error: 'Database save failure' })
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
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' })

    await conn.db.collection('annotations').deleteOne({ annotationId: id, username: user.username })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API DELETE Annotations] Error:', error)
    return NextResponse.json({ success: false, error: 'Database delete failure' })
  }
}
