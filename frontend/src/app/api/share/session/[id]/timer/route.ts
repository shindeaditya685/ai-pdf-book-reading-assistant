import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { requireSessionMember } from '@/lib/share-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  // IDOR fix: verify membership before mutating the timer.
  const membership = await requireSessionMember(sessionId, user)
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error }, { status: membership.status })
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const { action, mode } = await request.json()

  const existing = await conn.db.collection('sessionTimers').findOne({ sessionId })

  if (action === 'start') {
    const totalMs = mode === 'break' ? 5 * 60 * 1000 : 25 * 60 * 1000
    const now = new Date().toISOString()
    const timer = {
      sessionId,
      isRunning: true,
      mode: mode || 'focus',
      totalMs,
      startedAt: now,
      updatedAt: now,
    }
    await conn.db.collection('sessionTimers').updateOne(
      { sessionId },
      { $set: timer },
      { upsert: true }
    )
    return NextResponse.json(timer)
  }

  if (action === 'pause') {
    if (!existing) return NextResponse.json({ error: 'No timer' }, { status: 400 })
    const elapsed = Date.now() - new Date(existing.startedAt).getTime()
    const remaining = Math.max(0, existing.totalMs - elapsed)
    await conn.db.collection('sessionTimers').updateOne(
      { sessionId },
      { $set: { isRunning: false, remainingMs: remaining, updatedAt: new Date().toISOString() } }
    )
    return NextResponse.json({ ...existing, isRunning: false, remainingMs: remaining })
  }

  if (action === 'resume') {
    if (!existing) return NextResponse.json({ error: 'No timer' }, { status: 400 })
    const remaining = existing.remainingMs || existing.totalMs
    const now = new Date().toISOString()
    await conn.db.collection('sessionTimers').updateOne(
      { sessionId },
      { $set: { isRunning: true, startedAt: now, totalMs: remaining, updatedAt: now } }
    )
    return NextResponse.json({ ...existing, isRunning: true, startedAt: now, totalMs: remaining })
  }

  if (action === 'reset') {
    await conn.db.collection('sessionTimers').deleteOne({ sessionId })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
