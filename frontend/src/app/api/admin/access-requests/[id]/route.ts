import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { MIN_DISMISS_REASON, MAX_DISMISS_REASON } from '@/lib/access-request'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    let body: { reason?: string } = {}
    try { body = await request.json() } catch { /* allow empty body for back-compat */ }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, MAX_DISMISS_REASON) : ''
    if (reason.length < MIN_DISMISS_REASON) {
      return NextResponse.json(
        { error: `Please provide a reason of at least ${MIN_DISMISS_REASON} characters so the user understands why.` },
        { status: 400 }
      )
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
    }

    const result = await conn.db.collection('accessRequests').updateOne(
      { _id: objectId },
      {
        $set: {
          status: 'dismissed',
          dismissedAt: new Date(),
          dismissedBy: admin.username,
          dismissReason: reason,
        },
      }
    )
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
