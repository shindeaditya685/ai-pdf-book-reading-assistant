import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const pageNumber = searchParams.get('pageNumber')
  const since = searchParams.get('since')

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const filter: any = { sessionId }
    if (pageNumber) filter.pageNumber = Number(pageNumber)
    if (since) filter.updatedAt = { $gt: since }

    const annotations = await conn.db
      .collection('sharedAnnotations')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json(annotations)
  } catch (error) {
    console.error('[API Shared Annotations Get] Error:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const body = await request.json()
    const { id, sessionId, pdfFileName, pageNumber, type, color, rects, points, thickness, noteText, x, y } = body

    if (!sessionId || !id) {
      return NextResponse.json({ error: 'sessionId and id required' }, { status: 400 })
    }

    const doc = {
      annotationId: id,
      sessionId,
      pdfFileName: pdfFileName || '',
      pageNumber: Number(pageNumber) || 0,
      type: type || 'highlight',
      author: user.username,
      color: color || '#3B82F6',
      rects: rects || [],
      points: points || [],
      thickness: Number(thickness) || 3,
      noteText: noteText || '',
      x: x !== undefined ? Number(x) : undefined,
      y: y !== undefined ? Number(y) : undefined,
      comments: [],
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await conn.db.collection('sharedAnnotations').updateOne(
      { annotationId: id, sessionId },
      { $set: doc as any },
      { upsert: true }
    )

    return NextResponse.json(doc)
  } catch (error) {
    console.error('[API Shared Annotations Post] Error:', error)
    return NextResponse.json({ error: 'Failed to save annotation' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const sessionId = searchParams.get('sessionId')
    if (!id || !sessionId) {
      return NextResponse.json({ error: 'id and sessionId required' }, { status: 400 })
    }

    const ann = await conn.db.collection('sharedAnnotations').findOne({ annotationId: id, sessionId })
    if (!ann) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (ann.author !== user.username) {
      return NextResponse.json({ error: 'Only the author can delete' }, { status: 403 })
    }

    await conn.db.collection('sharedAnnotations').deleteOne({ annotationId: id, sessionId })
    await conn.db.collection('sessionEvents').insertOne({
      sessionId,
      type: 'annotation-deleted',
      annotationId: id,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Shared Annotations Delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
