import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const result = await conn.db
      .collection('annotations')
      .deleteMany({ type: 'drawing', username: user.username })
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error('[API Clear Drawings] Error:', error)
    return NextResponse.json({ error: 'Failed to clear drawings' }, { status: 500 })
  }
}
