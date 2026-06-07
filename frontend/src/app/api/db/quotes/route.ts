import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { QUOTE_LIMITS, cleanText } from '@/lib/quotes'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pdfFileName = searchParams.get('pdfFileName')
  const search = searchParams.get('search')?.trim()

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const filter: Record<string, unknown> = { username: user.username }
    if (pdfFileName) filter.pdfFileName = pdfFileName
    if (search) {
      // Match against the quote text, optional context, and the user's note.
      filter.$or = [
        { text: { $regex: escapeRegex(search), $options: 'i' } },
        { context: { $regex: escapeRegex(search), $options: 'i' } },
        { noteText: { $regex: escapeRegex(search), $options: 'i' } },
      ]
    }
    const docs = await conn.db
      .collection('quotes')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(500)
      .toArray()
    return NextResponse.json(docs.map(serializeQuote))
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })

  try {
    const body = await request.json()
    const text = cleanText(String(body.text ?? ''))
    if (!text) return NextResponse.json({ success: false, error: 'Quote text is required' }, { status: 400 })
    if (text.length > QUOTE_LIMITS.TEXT_MAX) {
      return NextResponse.json({ success: false, error: `Quote must be \u2264 ${QUOTE_LIMITS.TEXT_MAX} characters` }, { status: 400 })
    }
    const context = cleanText(String(body.context ?? '')).slice(0, QUOTE_LIMITS.CONTEXT_MAX)
    const noteText = cleanText(String(body.noteText ?? '')).slice(0, QUOTE_LIMITS.NOTE_MAX)
    const pdfFileName = String(body.pdfFileName ?? '').trim()
    if (!pdfFileName) return NextResponse.json({ success: false, error: 'pdfFileName is required' }, { status: 400 })
    const pageNumber = Math.max(0, Math.floor(Number(body.pageNumber) || 0))

    // Optional highlight rects (validated shallowly)
    const rectsIn = Array.isArray(body.rects) ? body.rects : []
    const rects = rectsIn
      .filter((r: unknown): r is { left: number; top: number; width: number; height: number } =>
        typeof r === 'object' && r !== null &&
        Number.isFinite((r as { left: unknown }).left) &&
        Number.isFinite((r as { top: unknown }).top) &&
        Number.isFinite((r as { width: unknown }).width) &&
        Number.isFinite((r as { height: unknown }).height)
      )
      .slice(0, 200)
      .map((r) => ({
        left: Math.max(0, Number(r.left)),
        top: Math.max(0, Number(r.top)),
        width: Math.max(0, Number(r.width)),
        height: Math.max(0, Number(r.height)),
      }))

    const color = typeof body.color === 'string' && body.color.length <= 60 ? body.color : 'rgba(253, 224, 71, 0.65)'

    const doc = {
      text,
      context,
      noteText,
      pdfFileName,
      pageNumber,
      rects,
      color,
      username: user.username,
      timestamp: new Date(),
    }
    const result = await conn.db.collection('quotes').insertOne(doc)
    return NextResponse.json({ success: true, id: result.insertedId.toString(), quote: serializeQuote({ ...doc, _id: result.insertedId } as Record<string, unknown>) })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save quote' }, { status: 500 })
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function serializeQuote(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    text: String(doc.text || ''),
    context: String(doc.context || ''),
    noteText: String(doc.noteText || ''),
    pdfFileName: String(doc.pdfFileName || ''),
    pageNumber: Number(doc.pageNumber) || 0,
    rects: Array.isArray(doc.rects) ? doc.rects : [],
    color: String(doc.color || 'rgba(253, 224, 71, 0.65)'),
    username: String(doc.username || ''),
    timestamp: toMs(doc.timestamp),
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
