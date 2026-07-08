import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { requireSessionMember } from '@/lib/share-auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params
    const ann = await conn.db.collection('sharedAnnotations').findOne({ annotationId: id, sessionId })
    if (!ann) return NextResponse.json([])
    return NextResponse.json(ann.comments || [])
  } catch (error) {
    console.error('[API Shared Comments Get] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    const { sessionId, text } = await request.json()
    if (!sessionId || !text?.trim()) {
      return NextResponse.json({ error: 'sessionId and text required' }, { status: 400 })
    }

    // IDOR fix
    const membership = await requireSessionMember(sessionId, user)
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status })
    }

    const mentions = text.match(/@(\w+)/g)?.map((m: string) => m.slice(1)) || []

    const comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: user.username,
      text: text.trim(),
      mentions,
      createdAt: new Date().toISOString(),
    }

    await conn.db.collection('sharedAnnotations').updateOne(
      { annotationId: id, sessionId },
      {
        $push: { comments: { $each: [comment] } as any },
        $set: { updatedAt: new Date().toISOString() },
      }
    )

    return NextResponse.json(comment)
  } catch (error) {
    console.error('[API Shared Comments Post] Error:', error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
