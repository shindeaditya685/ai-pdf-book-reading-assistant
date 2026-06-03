import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

const USER_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    const { action } = await request.json()

    const session = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(id) })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    if (action === 'join') {
      if (session.members.some((m: any) => m.username === user.username)) {
        return NextResponse.json(session)
      }

      const usedColors = new Set(session.members.map((m: any) => m.color))
      const available = USER_COLORS.find((c) => !usedColors.has(c))
      const color = available || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

      await conn.db.collection('shareSessions').updateOne(
        { _id: new ObjectId(id) },
        {
          $push: { members: { $each: [{ username: user.username, color, joinedAt: new Date().toISOString() }] } as any },
          $set: { updatedAt: new Date().toISOString() },
        }
      )

      const updated = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(id) })
      return NextResponse.json(updated)
    }

    if (action === 'leave') {
      await conn.db.collection('shareSessions').updateOne(
        { _id: new ObjectId(id) },
        {
          $pull: { members: { username: user.username } } as any,
          $set: { updatedAt: new Date().toISOString() },
        }
      )

      const updated = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(id) })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API Share Session Action] Error:', error)
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    const session = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(id) })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.createdBy !== user.username) {
      return NextResponse.json({ error: 'Only the creator can delete the session' }, { status: 403 })
    }

    await conn.db.collection('shareSessions').deleteOne({ _id: new ObjectId(id) })
    await conn.db.collection('sharedAnnotations').deleteMany({ sessionId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Share Session Delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
