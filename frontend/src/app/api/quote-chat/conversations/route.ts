import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { QUOTE_LIMITS, cleanText, truncate } from '@/lib/quotes'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ conversations: [] })

  try {
    const docs = await conn.db
      .collection('quoteConversations')
      .find({ username: user.username })
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray()
    return NextResponse.json({ conversations: docs.map(serializeConversation) })
  } catch {
    return NextResponse.json({ conversations: [] })
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })

  try {
    const body = await request.json()
    const title = cleanText(String(body.title ?? 'New quote chat')).slice(0, QUOTE_LIMITS.CHAT_TITLE_MAX) || 'New quote chat'
    const quoteIdsIn = Array.isArray(body.quoteIds) ? body.quoteIds : []
    const quoteIds = Array.from(new Set(quoteIdsIn.filter((s: unknown) => typeof s === 'string'))) as string[]

    // Cap pinned quotes (most recent first by insertion order)
    const capped = quoteIds.slice(0, QUOTE_LIMITS.PINNED_QUOTES_MAX)

    // Look up pdf file names for the pinned quotes
    let pdfFileNames: string[] = []
    if (capped.length > 0) {
      const objectIds = capped
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id))
      if (objectIds.length > 0) {
        const quotes = await conn.db
          .collection('quotes')
          .find({ _id: { $in: objectIds }, username: user.username }, { projection: { pdfFileName: 1 } })
          .toArray()
        pdfFileNames = Array.from(new Set(quotes.map((q) => q.pdfFileName).filter(Boolean)))
      }
    }

    const now = new Date()
    const doc = {
      username: user.username,
      title,
      quoteIds: capped,
      pdfFileNames,
      createdAt: now,
      updatedAt: now,
    }
    const result = await conn.db.collection('quoteConversations').insertOne(doc)
    return NextResponse.json({ success: true, conversation: serializeConversation({ ...doc, _id: result.insertedId } as Record<string, unknown>) })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create conversation' }, { status: 500 })
  }
}

function serializeConversation(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    title: String(doc.title || ''),
    quoteIds: Array.isArray(doc.quoteIds) ? (doc.quoteIds as string[]) : [],
    pdfFileNames: Array.isArray(doc.pdfFileNames) ? (doc.pdfFileNames as string[]) : [],
    createdAt: toMs(doc.createdAt),
    updatedAt: toMs(doc.updatedAt),
  }
}

function toMs(t: unknown): number {
  if (t instanceof Date) return t.getTime()
  if (typeof t === 'number' && Number.isFinite(t)) return t
  if (typeof t === 'string') {
    const n = new Date(t).getTime()
    return Number.isFinite(n) ? n : Date.now()
  }
  return Date.now()
}
