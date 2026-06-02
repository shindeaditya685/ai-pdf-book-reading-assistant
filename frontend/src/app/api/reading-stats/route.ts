import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ today: null, history: [], streak: 0, analytics: null })

  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365)
    const mode = searchParams.get('mode') || 'stats'

    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    const records = await conn.db
      .collection('readingStats')
      .find({ username: user.username, date: { $gte: since.toISOString().slice(0, 10) } })
      .sort({ date: -1 })
      .toArray()

    const today = records.find((r) => r.date === todayStr()) || null

    // Compute streak
    let streak = 0
    const checkDate = new Date()
    while (true) {
      const ds = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
      const found = records.some((r) => r.date === ds)
      if (!found && streak === 0) {
        checkDate.setDate(checkDate.getDate() - 1)
        continue
      }
      if (found) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    if (mode === 'analytics') {
      // Aggregate analytics
      let totalPages = 0, totalMinutes = 0, totalSessions = 0
      const bookTotals: Record<string, { pages: number; minutes: number }> = {}
      const dailyActivity: { date: string; pages: number; minutes: number }[] = []

      for (const r of records) {
        totalPages += r.pagesRead || 0
        totalMinutes += Math.round((r.timeSpentMs || 0) / 60000)
        totalSessions += r.sessions || 0

        dailyActivity.push({
          date: r.date,
          pages: r.pagesRead || 0,
          minutes: Math.round((r.timeSpentMs || 0) / 60000),
        })

        // Book breakdown
        if (r.books) {
          for (const [fileName, bData] of Object.entries(r.books)) {
            const b = bData as any
            if (!bookTotals[fileName]) bookTotals[fileName] = { pages: 0, minutes: 0 }
            bookTotals[fileName].pages += b.pagesRead || 0
            bookTotals[fileName].minutes += Math.round((b.timeSpentMs || 0) / 60000)
          }
        } else if (r.pdfFileName) {
          // Legacy: top-level pdfFileName field
          const fn = r.pdfFileName
          if (!bookTotals[fn]) bookTotals[fn] = { pages: 0, minutes: 0 }
          bookTotals[fn].pages += r.pagesRead || 0
          bookTotals[fn].minutes += Math.round((r.timeSpentMs || 0) / 60000)
        }
      }

      const dayCount = records.length
      const daysActive = new Set(records.map((r) => r.date)).size

      const analytics = {
        totalPages,
        totalMinutes,
        totalSessions,
        avgPagesPerDay: dayCount > 0 ? Math.round((totalPages / dayCount) * 10) / 10 : 0,
        avgMinutesPerDay: dayCount > 0 ? Math.round((totalMinutes / dayCount) * 10) / 10 : 0,
        readingSpeed: totalMinutes > 0 ? Math.round((totalPages / totalMinutes) * 60 * 10) / 10 : 0,
        daysActive,
        bookBreakdown: Object.entries(bookTotals)
          .map(([name, data]) => ({ pdfFileName: name, ...data }))
          .sort((a, b) => b.pages - a.pages),
        dailyActivity: dailyActivity.sort((a, b) => a.date.localeCompare(b.date)),
      }

      return NextResponse.json({ today, history: records, streak, analytics })
    }

    return NextResponse.json({ today, history: records, streak })
  } catch {
    return NextResponse.json({ today: null, history: [], streak: 0, analytics: null })
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { pagesRead = 0, timeSpentMs = 0, pdfFileName } = body
    const today = todayStr()

    const existing = await conn.db.collection('readingStats').findOne({
      username: user.username,
      date: today,
    })

    if (existing) {
      const update: any = {
        $inc: { pagesRead, timeSpentMs, sessions: 1 },
        $set: { updatedAt: new Date() },
      }
      // Track per-book stats
      if (pdfFileName) {
        update.$inc[`books.${pdfFileName}.pagesRead`] = pagesRead
        update.$inc[`books.${pdfFileName}.timeSpentMs`] = timeSpentMs
      }
      await conn.db.collection('readingStats').updateOne({ _id: existing._id }, update)
    } else {
      const doc: any = {
        username: user.username,
        date: today,
        pagesRead,
        timeSpentMs,
        sessions: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      if (pdfFileName) {
        doc.books = { [pdfFileName]: { pagesRead, timeSpentMs } }
      }
      await conn.db.collection('readingStats').insertOne(doc)
    }

    const updated = await conn.db.collection('readingStats').findOne({
      username: user.username,
      date: today,
    })

    return NextResponse.json({ success: true, today: updated })
  } catch {
    return NextResponse.json({ success: false })
  }
}
