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
    const bookmarks = await conn.db
      .collection('sharedBookmarks')
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .toArray()
    return NextResponse.json(bookmarks)
  } catch (error) {
    console.error('[API Shared Bookmarks Get] Error:', error)
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
    const { id, sessionId, word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName } = body

    if (!sessionId || !word) {
      return NextResponse.json({ error: 'sessionId and word required' }, { status: 400 })
    }

    // IDOR fix
    const membership = await requireSessionMember(sessionId, user)
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status })
    }

    const now = new Date().toISOString()
    const doc = {
      bookmarkId: id || `bm-${Date.now()}`,
      sessionId,
      word,
      meaning: meaning || '',
      pronunciation: pronunciation || '',
      translation: translation || '',
      sentence: sentence || '',
      pageNumber: Number(pageNumber) || 0,
      pdfFileName: pdfFileName || '',
      author: user.username,
      timestamp: now,
      updatedAt: now,
    }

    await conn.db.collection('sharedBookmarks').updateOne(
      { bookmarkId: doc.bookmarkId, sessionId },
      { $set: doc as any },
      { upsert: true }
    )

    return NextResponse.json(doc)
  } catch (error) {
    console.error('[API Shared Bookmarks Post] Error:', error)
    return NextResponse.json({ error: 'Failed to save bookmark' }, { status: 500 })
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

    const bm = await conn.db.collection('sharedBookmarks').findOne({ bookmarkId: id, sessionId })
    if (!bm) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (bm.author !== user.username) {
      return NextResponse.json({ error: 'Only the author can delete' }, { status: 403 })
    }

    await conn.db.collection('sharedBookmarks').deleteOne({ bookmarkId: id, sessionId })
    await conn.db.collection('sessionEvents').insertOne({
      sessionId,
      type: 'bookmark-deleted',
      bookmarkId: id,
      createdAt: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Shared Bookmarks Delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

