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
    const days = 30
    const since = new Date(Date.now() - days * 86400000)

    // Daily user signups
    const userPipeline = [
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]
    const userSignups = await db.collection('users').aggregate(userPipeline).toArray()

    // Daily PDF uploads
    const pdfPipeline = [
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]
    const pdfUploads = await db.collection('pdfs').aggregate(pdfPipeline).toArray()

    // Plan breakdown
    const planBreakdown = await db.collection('users').aggregate([
      { $group: { _id: { $ifNull: ['$plan', 'free'] }, count: { $sum: 1 } } },
    ]).toArray()

    return NextResponse.json({
      userSignups: userSignups.map((d) => ({ date: d._id, count: d.count })),
      pdfUploads: pdfUploads.map((d) => ({ date: d._id, count: d.count })),
      planBreakdown: planBreakdown.map((d) => ({ plan: d._id, count: d.count })),
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
