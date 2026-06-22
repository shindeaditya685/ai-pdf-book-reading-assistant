import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const announcements = await conn.db
      .collection('announcements')
      .find()
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({ announcements })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { title, body: messageBody, expiresAt } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const announcement = {
      title: title.trim(),
      body: messageBody.trim(),
      createdBy: admin.username,
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: true,
    }

    const result = await conn.db.collection('announcements').insertOne(announcement)

    await logAudit({
      adminUsername: admin.username,
      action: 'create_announcement',
      targetUsername: 'system',
      details: title.trim().slice(0, 100),
    })

    return NextResponse.json({ announcement: { ...announcement, _id: result.insertedId } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
