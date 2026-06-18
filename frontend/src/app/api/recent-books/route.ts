import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ books: [] })

  try {
    const pdfs = await conn.db
      .collection('pdfs')
      .find(
        { username: user.username, lastAccessedAt: { $exists: true } },
        { projection: { content: 0, ocrText: 0 } }
      )
      .sort({ lastAccessedAt: -1 })
      .limit(4)
      .toArray()

    const books = pdfs.map((pdf) => ({
      fileName: pdf.fileName,
      pageCount: pdf.pageCount || 0,
      lastPage: pdf.lastPage || 1,
      coverImage: pdf.coverImage || null,
    }))

    return NextResponse.json({ books })
  } catch {
    return NextResponse.json({ books: [] })
  }
}
