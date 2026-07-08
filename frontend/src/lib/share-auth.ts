import { connectToDatabase } from './db'
import { ObjectId } from 'mongodb'

export interface SessionUser {
  username: string
}

export type MembershipResult =
  | { ok: true; session: any }
  | { ok: false; status: number; error: string }

/**
 * Verify that `user` is a member of the share session `sessionId`.
 * Membership is enforced inside the MongoDB query (no separate fetch needed).
 *
 * Usage:
 *   const membership = await requireSessionMember(sessionId, user)
 *   if (!membership.ok) return NextResponse.json({ error: membership.error }, { status: membership.status })
 *   const session = membership.session
 */
export async function requireSessionMember(
  sessionId: string,
  user: SessionUser,
): Promise<MembershipResult> {
  if (!ObjectId.isValid(sessionId)) {
    return { ok: false, status: 400, error: 'Invalid session id' }
  }
  const conn = await connectToDatabase()
  if (!conn) return { ok: false, status: 503, error: 'Database unavailable' }

  const session = await conn.db.collection('shareSessions').findOne({
    _id: new ObjectId(sessionId),
    'members.username': user.username,
  })

  if (!session) {
    return { ok: false, status: 403, error: 'Not a member of this session' }
  }
  return { ok: true, session }
}

/**
 * Atomic guard against double-join races.
 * Only pushes the new member if they aren't already present.
 */
export async function atomicJoinSession(
  sessionId: string,
  username: string,
  color: string,
): Promise<void> {
  const conn = await connectToDatabase()
  if (!conn) return
  await conn.db.collection('shareSessions').updateOne(
    {
      _id: new ObjectId(sessionId),
      'members.username': { $ne: username },
    },
    {
      $push: { members: { username, color, joinedAt: new Date().toISOString() } } as any,
      $set: { updatedAt: new Date().toISOString() },
    },
  )
}
