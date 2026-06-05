import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const { id: sessionId } = await params
  const { text } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const session = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(sessionId) })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const member = session.members?.find((m: any) => m.username === user.username)
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const msg = {
    sessionId,
    username: user.username,
    color: member.color || '#3B82F6',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  }

  const result = await conn.db.collection('sessionChat').insertOne(msg)
  return NextResponse.json({ ...msg, _id: result.insertedId.toString() })
}
