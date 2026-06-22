import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'

export async function GET() {
  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ announcements: [] })

    const announcements = await conn.db
      .collection('announcements')
      .find({
        active: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({ announcements })
  } catch {
    return NextResponse.json({ announcements: [] })
  }
}
