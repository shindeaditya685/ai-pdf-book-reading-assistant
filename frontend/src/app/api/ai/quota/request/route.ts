import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { message?: string } = {}
    try { body = await request.json() } catch { /* allow empty body */ }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : ''

    const conn = await connectToDatabase()
    if (!conn) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    let objectId: ObjectId
    try { objectId = new ObjectId(user.id) } catch {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const db = conn.db

    const existing = await db.collection('accessRequests').findOne(
      { userId: objectId, status: 'pending' }
    )
    if (existing) {
      return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 })
    }

    await db.collection('accessRequests').insertOne({
      userId: objectId,
      username: user.username,
      message,
      status: 'pending',
      createdAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
