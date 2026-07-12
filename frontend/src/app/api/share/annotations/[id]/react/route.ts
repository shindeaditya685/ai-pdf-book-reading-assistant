import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const { id: annotationId } = await params
  const { sessionId, emoji } = await request.json()
  if (!sessionId || !emoji) {
    return NextResponse.json({ error: 'sessionId and emoji required' }, { status: 400 })
  }

  const ann = await conn.db.collection('sharedAnnotations').findOne({
    annotationId,
    sessionId,
  })
  if (!ann) return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })

  const reactions = ann.reactions || {}
  const users = reactions[emoji] || []

  if (users.includes(user.username)) {
    reactions[emoji] = users.filter((u: string) => u !== user.username)
    if (reactions[emoji].length === 0) delete reactions[emoji]
  } else {
    reactions[emoji] = [...users, user.username]
  }

  await conn.db.collection('sharedAnnotations').updateOne(
    { annotationId, sessionId },
    { $set: { reactions, updatedAt: new Date().toISOString() } }
  )

  return NextResponse.json({ reactions, annotationId, sessionId })
}
