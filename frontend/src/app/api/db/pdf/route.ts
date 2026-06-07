import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

const toPositiveInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(fallback, Math.round(parsed))
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('fileName')
  const sessionId = searchParams.get('sessionId')

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    if (sessionId) {
      const { ObjectId } = await import('mongodb')
      const session = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(sessionId) })
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (!session.members.some((m: any) => m.username === user.username)) {
        return NextResponse.json({ error: 'Not a session member' }, { status: 403 })
      }
      const pdf = await conn.db.collection('pdfs').findOne({ fileName: session.pdfFileName })
      if (!pdf) return NextResponse.json(null)
      return NextResponse.json(pdf)
    }

    if (fileName) {
      const pdf = await conn.db.collection('pdfs').findOne({ fileName, username: user.username })
      if (!pdf) return NextResponse.json(null)
      return NextResponse.json(pdf)
    }

    const pdfs = await conn.db
      .collection('pdfs')
      .find({ username: user.username }, { projection: { content: 0, ocrText: 0 } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray()

    const pdfsWithStats = await Promise.all(
      pdfs.map(async (pdf) => {
        const [wordCount, bookmarkCount] = await Promise.all([
          conn.db.collection('wordHistory').countDocuments({ pdfFileName: pdf.fileName, username: user.username }),
          conn.db.collection('bookmarks').countDocuments({ pdfFileName: pdf.fileName, username: user.username }),
        ])

        return {
          ...pdf,
          wordCount,
          bookmarkCount,
          lastPage: toPositiveInt(pdf.lastPage, 1),
          pageCount: toPositiveInt(pdf.pageCount, 0),
        }
      })
    )

    return NextResponse.json(pdfsWithStats)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { fileName, content, pageCount, lastPage } = body
    if (!fileName || !content) return NextResponse.json({ success: false })

    const safePageCount = toPositiveInt(pageCount, 0)
    const safeLastPage = Math.max(1, toPositiveInt(lastPage, 1))

    const existing = await conn.db.collection('pdfs').findOne({ fileName, username: user.username })
    if (existing) {
      const existingPageCount = toPositiveInt(existing.pageCount, 0)
      const existingLastPage = Math.max(1, toPositiveInt(existing.lastPage, 1))
      await conn.db.collection('pdfs').updateOne(
        { _id: existing._id },
        {
          $set: {
            content,
            pageCount: Math.max(existingPageCount, safePageCount),
            lastPage: Math.max(existingLastPage, safeLastPage),
            updatedAt: new Date(),
          },
        }
      )
      return NextResponse.json({ id: existing._id, success: true })
    }

    const result = await conn.db.collection('pdfs').insertOne({
      fileName,
      content,
      pageCount: safePageCount,
      lastPage: safeLastPage,
      username: user.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return NextResponse.json({ id: result.insertedId.toString(), success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}

export async function PATCH(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { fileName, ocrText, pageCount, lastPage } = body
    if (!fileName) return NextResponse.json({ success: false })

    const existing = await conn.db.collection('pdfs').findOne({ fileName, username: user.username })
    if (!existing) return NextResponse.json({ success: false })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if ('ocrText' in body) updates.ocrText = ocrText || {}
    if ('pageCount' in body) updates.pageCount = toPositiveInt(pageCount, 0)
    if ('lastPage' in body) updates.lastPage = Math.max(1, toPositiveInt(lastPage, 1))

    await conn.db.collection('pdfs').updateOne(
      { _id: existing._id },
      { $set: updates }
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}

export async function DELETE(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName')
    if (!fileName) return NextResponse.json({ success: false })

    await conn.db.collection('pdfs').deleteOne({ fileName, username: user.username })
    await conn.db.collection('bookmarks').deleteMany({ pdfFileName: fileName, username: user.username })
    await conn.db.collection('wordHistory').deleteMany({ pdfFileName: fileName, username: user.username })
    await conn.db.collection('history').deleteMany({ pdfFileName: fileName, username: user.username })
    await conn.db.collection('annotations').deleteMany({ pdfFileName: fileName, username: user.username })
    await conn.db.collection('quotes').deleteMany({ pdfFileName: fileName, username: user.username })
    // Conversations: detach quotes from this book and drop the conversation
    // entirely if it ends up with no quotes (otherwise the chat is broken).
    const droppedQuotes = await conn.db
      .collection('quotes')
      .find({ pdfFileName: fileName, username: user.username }, { projection: { _id: 1 } })
      .toArray()
    const droppedIds = droppedQuotes.map((q) => q._id.toString())
    if (droppedIds.length > 0) {
      const conversations = await conn.db
        .collection('quoteConversations')
        .find({ username: user.username, quoteIds: { $in: droppedIds } })
        .toArray()
      const now = new Date()
      for (const conv of conversations) {
        const remaining = (conv.quoteIds as string[]).filter((qid) => !droppedIds.includes(qid))
        if (remaining.length === 0) {
          await conn.db.collection('quoteConversations').deleteOne({ _id: conv._id, username: user.username })
          await conn.db.collection('quoteMessages').deleteMany({ conversationId: conv._id.toString() })
        } else {
          await conn.db.collection('quoteConversations').updateOne(
            { _id: conv._id, username: user.username },
            { $set: { quoteIds: remaining, pdfFileNames: (conv.pdfFileNames as string[]).filter((p) => p !== fileName), updatedAt: now } }
          )
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
