import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
    }

    await conn.db.collection('accessRequests').updateOne(
      { _id: objectId },
      { $set: { status: 'dismissed', dismissedAt: new Date(), dismissedBy: admin.username } }
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
