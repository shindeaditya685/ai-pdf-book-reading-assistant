import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

const USER_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
]

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { name, pdfFileName } = await request.json()
    if (!name || !pdfFileName) {
      return NextResponse.json({ error: 'name and pdfFileName required' }, { status: 400 })
    }

    let inviteCode: string
    do {
      inviteCode = generateCode()
    } while (await conn.db.collection('shareSessions').findOne({ inviteCode }))

    const doc = {
      name,
      inviteCode,
      pdfFileName,
      createdBy: user.username,
      members: [{ username: user.username, color: USER_COLORS[0], joinedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const result = await conn.db.collection('shareSessions').insertOne(doc)
    return NextResponse.json({ ...doc, _id: result.insertedId.toString() })
  } catch (error) {
    console.error('[API Share Session Create] Error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const code = searchParams.get('code')

    if (id) {
      const session = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(id) })
      if (!session) return NextResponse.json(null)
      return NextResponse.json(session)
    }

    if (code) {
      const session = await conn.db.collection('shareSessions').findOne({ inviteCode: code })
      return NextResponse.json(session)
    }

    const sessions = await conn.db
      .collection('shareSessions')
      .find({ 'members.username': user.username })
      .sort({ updatedAt: -1 })
      .toArray()

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('[API Share Session Get] Error:', error)
    return NextResponse.json([])
  }
}
