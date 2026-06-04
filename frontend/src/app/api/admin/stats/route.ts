import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const db = conn.db
    const [totalUsers, totalPdfs, totalBookmarks, totalAnnotations, totalWords, shareSessions] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('pdfs').countDocuments(),
      db.collection('bookmarks').countDocuments(),
      db.collection('annotations').countDocuments(),
      db.collection('wordHistory').countDocuments(),
      db.collection('shareSessions').countDocuments(),
    ])

    return NextResponse.json({
      stats: {
        users: totalUsers,
        pdfs: totalPdfs,
        bookmarks: totalBookmarks,
        annotations: totalAnnotations,
        wordsLookedUp: totalWords,
        shareSessions,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
