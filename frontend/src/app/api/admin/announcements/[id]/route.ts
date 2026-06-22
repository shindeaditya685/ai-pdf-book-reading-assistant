import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { logAudit } from '@/lib/audit'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch {
      return NextResponse.json({ error: 'Invalid announcement id' }, { status: 400 })
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const announcement = await conn.db.collection('announcements').findOne({ _id: objectId })
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    await conn.db.collection('announcements').deleteOne({ _id: objectId })

    await logAudit({
      adminUsername: admin.username,
      action: 'delete_announcement',
      targetUsername: 'system',
      details: (announcement.title || '').slice(0, 100),
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
