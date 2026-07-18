import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ books: [] })

  try {
    const pdfs: string[] = await conn.db.collection('bookmarks').distinct('pdfFileName', {
      username: user.username,
      pdfFileName: { $ne: 'bulk-import' },
    })
    const books = pdfs
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, label: name.replace(/\.pdf$/i, '').replace(/_/g, ' ') }))
    return NextResponse.json({ books })
  } catch {
    return NextResponse.json({ books: [] })
  }
}
