import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { REQUEST_COOLDOWN_DAYS } from '@/lib/access-request'

const MIN_MESSAGE = 10
const MAX_MESSAGE = 500

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { message?: string } = {}
    try { body = await request.json() } catch { /* allow empty body */ }
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if (rawMessage.length < MIN_MESSAGE) {
      return NextResponse.json(
        { error: `Please tell us why you need Pro access (at least ${MIN_MESSAGE} characters).` },
        { status: 400 }
      )
    }
    const message = rawMessage.slice(0, MAX_MESSAGE)

    const conn = await connectToDatabase()
    if (!conn) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    let objectId: ObjectId
    try { objectId = new ObjectId(user.id) } catch {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const db = conn.db
    const requests = db.collection('accessRequests')

    const pending = await requests.findOne({ userId: objectId, status: 'pending' })
    if (pending) {
      return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 })
    }

    const lastDismissed = await requests.findOne(
      { userId: objectId, status: 'dismissed' },
      { sort: { dismissedAt: -1 } }
    )
    if (lastDismissed?.dismissedAt) {
      const dismissedAt = new Date(lastDismissed.dismissedAt)
      const cooldownEndsAt = new Date(dismissedAt.getTime() + REQUEST_COOLDOWN_DAYS * 86400000)
      const now = Date.now()
      if (cooldownEndsAt.getTime() > now) {
        const daysRemaining = Math.ceil((cooldownEndsAt.getTime() - now) / 86400000)
        return NextResponse.json(
          {
            error: `Your previous request was dismissed. You can request again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
            cooldown: {
              active: true,
              daysRemaining,
              cooldownEndsAt: cooldownEndsAt.toISOString(),
              reason: lastDismissed.dismissReason || '',
            },
          },
          { status: 429 }
        )
      }
    }

    await requests.insertOne({
      userId: objectId,
      username: user.username,
      message,
      requestedPlan: 'pro',
      status: 'pending',
      createdAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
