import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { QUOTE_LIMITS, cleanText } from '@/lib/quotes'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return getConversation(user.username, await params)
}

async function getConversation(username: string, { id }: { id: string }) {
  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  try {
    if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const conv = await conn.db.collection('quoteConversations').findOne({ _id: new ObjectId(id), username })
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const messages = await conn.db
      .collection('quoteMessages')
      .find({ conversationId: id })
      .sort({ createdAt: 1 })
      .toArray()

    // Hydrate the quotes referenced by this conversation so the client can
    // render context pills and jump back to the page.
    const quoteIds = Array.isArray(conv.quoteIds) ? (conv.quoteIds as string[]) : []
    const objectIds = quoteIds
      .filter((qid) => ObjectId.isValid(qid))
      .map((qid) => new ObjectId(qid))
    const quoteDocs = objectIds.length > 0
      ? await conn.db
          .collection('quotes')
          .find({ _id: { $in: objectIds }, username }, {
            projection: { _id: 1, text: 1, noteText: 1, pageNumber: 1, pdfFileName: 1, context: 1, color: 1 },
          })
          .toArray()
      : []

    return NextResponse.json({
      conversation: {
        id: id,
        title: conv.title,
        quoteIds,
        pdfFileNames: Array.isArray(conv.pdfFileNames) ? conv.pdfFileNames : [],
        createdAt: toMs(conv.createdAt),
        updatedAt: toMs(conv.updatedAt),
      },
      messages: messages.map(serializeMessage),
      quotes: quoteDocs.map(serializeQuote),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    if (!id || !ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
    const body = await request.json()
    const update: Record<string, unknown> = {}
    if (typeof body.title === 'string') {
      const t = cleanText(body.title)
      if (!t) return NextResponse.json({ success: false, error: 'Title cannot be empty' }, { status: 400 })
      update.title = t.slice(0, QUOTE_LIMITS.CHAT_TITLE_MAX)
    }
    if (Array.isArray(body.quoteIds)) {
      const quoteIds = Array.from(new Set(body.quoteIds.filter((s: unknown) => typeof s === 'string'))) as string[]
      update.quoteIds = quoteIds.slice(0, QUOTE_LIMITS.PINNED_QUOTES_MAX)
      // Re-derive pdf file names
      const objectIds = (update.quoteIds as string[])
        .filter((qid) => ObjectId.isValid(qid))
        .map((qid) => new ObjectId(qid))
      if (objectIds.length > 0) {
        const quotes = await conn.db
          .collection('quotes')
          .find({ _id: { $in: objectIds }, username: user.username }, { projection: { pdfFileName: 1 } })
          .toArray()
        update.pdfFileNames = Array.from(new Set(quotes.map((q) => q.pdfFileName).filter(Boolean)))
      } else {
        update.pdfFileNames = []
      }
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: 'No updatable fields provided' }, { status: 400 })
    }
    update.updatedAt = new Date()

    const result = await conn.db.collection('quoteConversations').updateOne(
      { _id: new ObjectId(id), username: user.username },
      { $set: update }
    )
    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update conversation' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    if (!id || !ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
    const objectId = new ObjectId(id)

    const conv = await conn.db.collection('quoteConversations').findOne({ _id: objectId, username: user.username })
    if (!conv) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    await conn.db.collection('quoteConversations').deleteOne({ _id: objectId, username: user.username })
    await conn.db.collection('quoteMessages').deleteMany({ conversationId: id })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete conversation' }, { status: 500 })
  }
}

function serializeMessage(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    conversationId: String(doc.conversationId || ''),
    role: String(doc.role || 'user'),
    content: String(doc.content || ''),
    quoteRefs: Array.isArray(doc.quoteRefs) ? doc.quoteRefs : [],
    createdAt: toMs(doc.createdAt),
  }
}

function serializeQuote(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    text: String(doc.text || ''),
    noteText: String(doc.noteText || ''),
    pageNumber: Number(doc.pageNumber) || 0,
    pdfFileName: String(doc.pdfFileName || ''),
    context: String(doc.context || ''),
    color: String(doc.color || 'rgba(253, 224, 71, 0.65)'),
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
