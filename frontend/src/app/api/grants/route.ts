import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ grants: [] })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ grants: [] })

    const grants = await conn.db
      .collection('grants')
      .find({
        username: user.username,
        active: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      })
      .sort({ grantedAt: -1 })
      .toArray()

    return NextResponse.json({ grants })
  } catch {
    return NextResponse.json({ grants: [] })
  }
}
