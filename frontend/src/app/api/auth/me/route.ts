import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { verifyToken, getUserFromDb } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'
import { isAIPlan, type AIPlan } from '@/lib/ai-plan'
import { REQUEST_COOLDOWN_DAYS } from '@/lib/access-request'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = verifyToken(auth.slice(7))
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const user = await getUserFromDb(payload)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  let pendingRequest: { requestedPlan: AIPlan | null; message: string } | null = null
  let lastDismissed: {
    dismissReason: string
    dismissedAt: string
    cooldownEndsAt: string
    daysRemaining: number
    active: boolean
  } | null = null

  try {
    const conn = await connectToDatabase()
    if (conn) {
      const objectId = (() => { try { return new ObjectId(user.id) } catch { return null } })()
      if (objectId) {
        const pending = await conn.db.collection('accessRequests').findOne(
          { userId: objectId, status: 'pending' },
          { projection: { requestedPlan: 1, message: 1 } }
        )
        if (pending) {
          pendingRequest = {
            requestedPlan: isAIPlan(pending.requestedPlan) ? (pending.requestedPlan as AIPlan) : null,
            message: pending.message || '',
          }
        }

        const dismissed = await conn.db.collection('accessRequests').findOne(
          { userId: objectId, status: 'dismissed' },
          { sort: { dismissedAt: -1 }, projection: { dismissReason: 1, dismissedAt: 1 } }
        )
        if (dismissed?.dismissedAt) {
          const dismissedAt = new Date(dismissed.dismissedAt)
          const cooldownEndsAt = new Date(dismissedAt.getTime() + REQUEST_COOLDOWN_DAYS * 86400000)
          const now = Date.now()
          const daysRemaining = Math.max(0, Math.ceil((cooldownEndsAt.getTime() - now) / 86400000))
          lastDismissed = {
            dismissReason: dismissed.dismissReason || '',
            dismissedAt: dismissedAt.toISOString(),
            cooldownEndsAt: cooldownEndsAt.toISOString(),
            daysRemaining,
            active: cooldownEndsAt.getTime() > now,
          }
        }
      }
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ user, pendingRequest, lastDismissed })
}
