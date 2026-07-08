import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getUserFromRequest } from '@/lib/auth'
import { requireSessionMember } from '@/lib/share-auth'

/**
 * Exchange a long-lived Bearer JWT for a short-lived (60s) SSE ticket
 * scoped to a single session. This keeps the 7-day JWT out of SSE URL
 * query strings (server logs, browser history, Referer headers).
 *
 * The client calls this right before opening the EventSource, then
 * appends ?ticket=... to the SSE URL.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const membership = await requireSessionMember(sessionId, user)
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error }, { status: membership.status })
  }

  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration: JWT_SECRET not set' }, { status: 500 })
  }

  const ticket = jwt.sign(
    { sid: sessionId, u: user.username, t: 'sse' },
    JWT_SECRET,
    { expiresIn: '60s' },
  )

  return NextResponse.json({ ticket, expiresIn: 60 })
}
