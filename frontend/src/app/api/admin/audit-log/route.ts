import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))

    const entries = await conn.db.collection('auditLog')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      entries: entries.map((e) => ({
        _id: e._id.toString(),
        adminUsername: e.adminUsername,
        action: e.action,
        targetUsername: e.targetUsername,
        details: e.details || '',
        createdAt: e.createdAt,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
