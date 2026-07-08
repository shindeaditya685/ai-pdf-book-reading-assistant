import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { requireSessionMember } from '@/lib/share-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: annotationId } = await params
  const { sessionId, emoji } = await request.json()
  if (!sessionId || !emoji) {
    return NextResponse.json({ error: 'sessionId and emoji required' }, { status: 400 })
  }

  // IDOR fix: verify membership before reacting.
  const membership = await requireSessionMember(sessionId, user)
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error }, { status: membership.status })
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const field = `reactions.${emoji}`
  const ann = await conn.db.collection('sharedAnnotations').findOne({ annotationId, sessionId })
  if (!ann) return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })

  const existing: string[] = (ann.reactions?.[emoji] as string[]) || []
  const hasReacted = existing.includes(user.username)

  // Race-condition fix: use atomic $addToSet / $pull instead of
  // read-modify-write, so concurrent reactions don't overwrite each other.
  if (hasReacted) {
    await conn.db.collection('sharedAnnotations').updateOne(
      { annotationId, sessionId },
      {
        $pull: { [field]: user.username } as Record<string, any>,
        $set: { updatedAt: new Date().toISOString() },
      },
    )
  } else {
    await conn.db.collection('sharedAnnotations').updateOne(
      { annotationId, sessionId },
      {
        $addToSet: { [field]: user.username },
        $set: { updatedAt: new Date().toISOString() },
      },
    )
  }

  const updated = await conn.db.collection('sharedAnnotations').findOne({ annotationId, sessionId })
  return NextResponse.json({ reactions: (updated as any)?.reactions || {}, annotationId, sessionId })
}
