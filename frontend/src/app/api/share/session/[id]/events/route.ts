import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

const POLL_INTERVAL_MS = 500
const PRESENCE_TIMEOUT_MS = 5000

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: sessionId } = await params
  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })
  const doc = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(sessionId) })
  if (!doc || !doc.members?.some((m: any) => m.username === user.username))
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const closed = { v: false }
  let lastPoll = new Date(Date.now() - 1000).toISOString()

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      let alive = true
      const send = (e: string, d: unknown) => {
        if (!alive) return
        try { controller.enqueue(enc.encode(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`)) }
        catch { alive = false }
      }

      const hb = setInterval(() => {
        if (!alive) { clearInterval(hb); return }
        send('heartbeat', { ts: Date.now() })
      }, 15000)

      const poll = setInterval(async () => {
        if (!alive) { clearInterval(poll); return }
        try {
          const since = lastPoll
          const now = new Date()

          const updatedDoc = await conn.db.collection('shareSessions').findOne(
            { _id: new ObjectId(sessionId), updatedAt: { $gt: since } }
          )
          if (updatedDoc) {
            send('session-updated', updatedDoc)
            const fm = updatedDoc.lastFollowMode
            if (fm?.at && fm.at > since && fm.leaderUsername !== user.username) {
              send('follow-mode', { enabled: fm.enabled, leaderUsername: fm.leaderUsername })
            }
          }

          const annotations = await conn.db.collection('sharedAnnotations')
            .find({ sessionId, updatedAt: { $gt: since } }).sort({ updatedAt: -1 }).toArray()
          for (const a of annotations) send('annotation', a)

          const bookmarks = await conn.db.collection('sharedBookmarks')
            .find({ sessionId, updatedAt: { $gt: since } }).sort({ timestamp: -1 }).toArray()
          if (bookmarks.length > 0) send('bookmarks', bookmarks)

          const flashcards = await conn.db.collection('sharedFlashcards')
            .find({ sessionId, updatedAt: { $gt: since } }).sort({ createdAt: -1 }).toArray()
          if (flashcards.length > 0) send('flashcards', flashcards)

          const quotes = await conn.db.collection('sharedQuotes')
            .find({ sessionId, updatedAt: { $gt: since } }).sort({ timestamp: -1 }).toArray()
          if (quotes.length > 0) send('quotes', quotes)

          const chatMsgs = await conn.db.collection('sessionChat')
            .find({ sessionId, createdAt: { $gt: since } }).sort({ createdAt: 1 }).toArray()
          for (const m of chatMsgs) send('chat-message', m)

          const events = await conn.db.collection('sessionEvents')
            .find({ sessionId, createdAt: { $gt: since } }).sort({ createdAt: 1 }).toArray()
          for (const ev of events) {
            if (ev.type === 'bookmark-deleted') send('bookmark-deleted', { bookmarkId: ev.bookmarkId })
            else if (ev.type === 'flashcard-deleted') send('flashcard-deleted', { flashcardId: ev.flashcardId })
            else if (ev.type === 'quote-deleted') send('quote-deleted', { quoteId: ev.quoteId })
            else if (ev.type === 'annotation-deleted') send('annotation-deleted', { annotationId: ev.annotationId })
          }

          const timerDoc = await conn.db.collection('sessionTimers').findOne({ sessionId })
          if (timerDoc) send('timer-state', timerDoc)

          const ttsDoc = await conn.db.collection('sessionTts').findOne({ sessionId })
          if (ttsDoc) send('tts-state', ttsDoc)

          const presenceCutoff = new Date(now.getTime() - PRESENCE_TIMEOUT_MS)
          const presence = await conn.db.collection('sessionPresence')
            .find({ sessionId, lastSeen: { $gt: presenceCutoff }, username: { $ne: user.username } })
            .toArray()
          const cursors: any[] = []
          const pages: any[] = []
          for (const p of presence) {
            cursors.push({ username: p.username, color: p.color, pageNumber: p.pageNumber, x: p.x, y: p.y })
            pages.push({ username: p.username, color: p.color, pageNumber: p.pageNumber })
          }
          if (cursors.length > 0) send('cursors', cursors)
          if (pages.length > 0) send('pages', pages)

          lastPoll = now.toISOString()
        } catch (err) {
          console.error('[SSE poll] error:', err)
        }
      }, POLL_INTERVAL_MS)

      request.signal.addEventListener('abort', () => {
        alive = false
        clearInterval(hb)
        clearInterval(poll)
        try { controller.close() } catch {}
      })
    },
    cancel() { closed.v = true },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: sessionId } = await params
  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database error' }, { status: 500 })
  const doc = await conn.db.collection('shareSessions').findOne({ _id: new ObjectId(sessionId) })
  const member = doc?.members?.find((m: any) => m.username === user.username)
  const color = member?.color || '#3B82F6'
  const { type, data } = await request.json()
  const presence = conn.db.collection('sessionPresence')

  if (type === 'cursor' || type === 'page-change') {
    await presence.updateOne(
      { sessionId, username: user.username },
      {
        $set: {
          sessionId,
          username: user.username,
          color,
          pageNumber: Number(data?.pageNumber) || 1,
          x: type === 'cursor' ? Number(data?.x) || 0 : 0,
          y: type === 'cursor' ? Number(data?.y) || 0 : 0,
          lastSeen: new Date(),
        },
      },
      { upsert: true }
    )
    return NextResponse.json({ success: true })
  }

  if (type === 'follow-mode') {
    await conn.db.collection('shareSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          updatedAt: new Date().toISOString(),
          lastFollowMode: {
            leaderUsername: user.username,
            enabled: !!data?.enabled,
            at: new Date().toISOString(),
          },
        },
      }
    )
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
