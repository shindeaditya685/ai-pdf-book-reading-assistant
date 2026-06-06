import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const requests = await conn.db
      .collection('accessRequests')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    return NextResponse.json({
      requests: requests.map((r) => ({
        _id: r._id.toString(),
        userId: r.userId.toString(),
        username: r.username,
        message: r.message || '',
        requestedPlan: r.requestedPlan || null,
        status: r.status,
        createdAt: r.createdAt,
        dismissReason: r.dismissReason || '',
        dismissedAt: r.dismissedAt || null,
        dismissedBy: r.dismissedBy || '',
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
