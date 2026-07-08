import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { requireSessionMember } from '@/lib/share-auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // IDOR fix
  const membership = await requireSessionMember(sessionId, user)
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error }, { status: membership.status })
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const quotes = await conn.db
      .collection('sharedQuotes')
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .toArray()
    return NextResponse.json(quotes)
  } catch (error) {
    console.error('[API Shared Quotes Get] Error:', error)
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
    const { id, sessionId, text, context, noteText, pageNumber, pdfFileName, rects, color } = body

    if (!sessionId || !text) {
      return NextResponse.json({ error: 'sessionId and text required' }, { status: 400 })
    }

    // IDOR fix
    const membership = await requireSessionMember(sessionId, user)
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status })
    }

    const now = new Date().toISOString()
    const doc = {
      quoteId: id || `qt-${Date.now()}`,
      sessionId,
      text,
      context: context || '',
      noteText: noteText || '',
      pageNumber: Number(pageNumber) || 0,
      pdfFileName: pdfFileName || '',
      rects: rects || [],
      color: color || 'rgba(253, 224, 71, 0.65)',
      author: user.username,
      timestamp: now,
      updatedAt: now,
    }

    await conn.db.collection('sharedQuotes').updateOne(
      { quoteId: doc.quoteId, sessionId },
      { $set: doc as any },
      { upsert: true }
    )

    return NextResponse.json(doc)
  } catch (error) {
    console.error('[API Shared Quotes Post] Error:', error)
    return NextResponse.json({ error: 'Failed to save quote' }, { status: 500 })
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

    // IDOR fix
    const membership = await requireSessionMember(sessionId, user)
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status })
    }

    const qt = await conn.db.collection('sharedQuotes').findOne({ quoteId: id, sessionId })
    if (!qt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (qt.author !== user.username) {
      return NextResponse.json({ error: 'Only the author can delete' }, { status: 403 })
    }

    await conn.db.collection('sharedQuotes').deleteOne({ quoteId: id, sessionId })
    await conn.db.collection('sessionEvents').insertOne({
      sessionId,
      type: 'quote-deleted',
      quoteId: id,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Shared Quotes Delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
