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
      .find({ username: user.username }, { projection: { content: 0, ocrText: 0 } })
      .sort({ updatedAt: -1 })
      .toArray()

    const books = await Promise.all(
      pdfs.map(async (pdf) => {
        const [wordCount, bookmarkCount, quoteCount, readingStats] = await Promise.all([
          conn.db.collection('wordHistory').countDocuments({ pdfFileName: pdf.fileName, username: user.username }),
          conn.db.collection('bookmarks').countDocuments({ pdfFileName: pdf.fileName, username: user.username }),
          conn.db.collection('quotes').countDocuments({ pdfFileName: pdf.fileName, username: user.username }),
          conn.db
            .collection('readingStats')
            .aggregate([
              { $match: { username: user.username, [`books.${pdf.fileName}`]: { $exists: true } } },
              { $group: { _id: null, pages: { $sum: `$books.${pdf.fileName}.pagesRead` }, minutes: { $sum: { $divide: [`$books.${pdf.fileName}.timeSpentMs`, 60000] } } } },
            ])
            .toArray(),
        ])

        const stats = readingStats[0] || { pages: 0, minutes: 0 }

        return {
          fileName: pdf.fileName,
          pageCount: pdf.pageCount || 0,
          lastPage: pdf.lastPage || 1,
          wordCount,
          bookmarkCount,
          quoteCount,
          totalPagesRead: Math.round(stats.pages || 0),
          totalMinutes: Math.round(stats.minutes || 0),
          createdAt: pdf.createdAt,
          updatedAt: pdf.updatedAt,
        }
      })
    )

    return NextResponse.json({ books })
  } catch {
    return NextResponse.json({ books: [] })
  }
}
