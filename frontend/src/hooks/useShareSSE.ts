'use client'

import { useEffect, useRef } from 'react'
import { usePDFStore, type SharedAnnotation } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/auth-context'

const CURSOR_INTERVAL_MS = 500
const MAX_RETRY_MS = 30000

export function useShareSSE() {
  const sessionId = usePDFStore((s) => s.shareSession?._id ?? null)
  const setShareSession = usePDFStore((s) => s.setShareSession)
  const setSharedAnnotations = usePDFStore((s) => s.setSharedAnnotations)
  const addSharedComment = usePDFStore((s) => s.addSharedComment)
  const setSharedBookmarks = usePDFStore((s) => s.setSharedBookmarks)
  const setSharedFlashcards = usePDFStore((s) => s.setSharedFlashcards)
  const setSharedQuotes = usePDFStore((s) => s.setSharedQuotes)
  const removeSharedBookmark = usePDFStore((s) => s.removeSharedBookmark)
  const removeSharedFlashcard = usePDFStore((s) => s.removeSharedFlashcard)
  const removeSharedQuote = usePDFStore((s) => s.removeSharedQuote)
  const addRemoteCursor = usePDFStore((s) => s.addRemoteCursor)
  const setRemotePage = usePDFStore((s) => s.setRemotePage)
  const setFollowMode = usePDFStore((s) => s.setFollowMode)
  const setSharedTimer = usePDFStore((s) => s.setSharedTimer)
  const setSharedTts = usePDFStore((s) => s.setSharedTts)
  const addSessionChatMessage = usePDFStore((s) => s.addSessionChatMessage)

  const { user } = useAuth()
  const esRef = useRef<EventSource | null>(null)
  const cursorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentPosRef = useRef<{ x: number; y: number; page: number } | null>(null)
  const closedRef = useRef(false)
  const retryRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const userRef = useRef<string | null>(null)

  useEffect(() => {
    sessionIdRef.current = sessionId
    userRef.current = user?.username ?? null

    if (!sessionId || !user?.username) {
      esRef.current?.close()
      esRef.current = null
      if (cursorTimerRef.current) { clearInterval(cursorTimerRef.current); cursorTimerRef.current = null }
      return
    }

    closedRef.current = false
    retryRef.current = 0

    const handleAnnotation = (raw: string) => {
      try {
        const ann: SharedAnnotation = JSON.parse(raw)
        const state = usePDFStore.getState()
        const merged = state.sharedAnnotations.filter((a) => a.annotationId !== ann.annotationId)
        merged.unshift(ann)
        setSharedAnnotations(merged)
      } catch {}
    }

    const handleChatMessage = (raw: string) => {
      try {
        const m = JSON.parse(raw)
        addSessionChatMessage({
          id: m._id || m.id || `cm-${m.createdAt}-${Math.random().toString(36).slice(2, 6)}`,
          username: m.username,
          color: m.color,
          text: m.text,
          createdAt: m.createdAt,
        })
      } catch {}
    }

    const handleSessionUpdated = (raw: string) => {
      try {
        const d = JSON.parse(raw)
        if (d?.members) {
          const cur = usePDFStore.getState().shareSession
          if (cur) setShareSession({ ...cur, members: d.members, updatedAt: d.updatedAt })
          else setShareSession(d)
        }
      } catch {}
    }

    const attach = (es: EventSource) => {
      es.addEventListener('session-updated', (e) => handleSessionUpdated((e as MessageEvent).data))
      es.addEventListener('annotation', (e) => handleAnnotation((e as MessageEvent).data))
      es.addEventListener('bookmarks', (e) => {
        try { setSharedBookmarks(JSON.parse((e as MessageEvent).data)) } catch {}
      })
      es.addEventListener('flashcards', (e) => {
        try { setSharedFlashcards(JSON.parse((e as MessageEvent).data)) } catch {}
      })
      es.addEventListener('quotes', (e) => {
        try { setSharedQuotes(JSON.parse((e as MessageEvent).data)) } catch {}
      })
      es.addEventListener('bookmark-deleted', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          if (d?.bookmarkId) removeSharedBookmark(d.bookmarkId)
        } catch {}
      })
      es.addEventListener('flashcard-deleted', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          if (d?.flashcardId) removeSharedFlashcard(d.flashcardId)
        } catch {}
      })
      es.addEventListener('quote-deleted', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          if (d?.quoteId) removeSharedQuote(d.quoteId)
        } catch {}
      })
      es.addEventListener('chat-message', (e) => handleChatMessage((e as MessageEvent).data))
      es.addEventListener('chat-messages', (e) => {
        try {
          const arr: any[] = JSON.parse((e as MessageEvent).data)
          for (const m of arr) handleChatMessage(JSON.stringify(m))
        } catch {}
      })
      es.addEventListener('timer-state', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          setSharedTimer({ isRunning: d.isRunning, mode: d.mode, totalMs: d.totalMs, startedAt: d.startedAt })
        } catch {}
      })
      es.addEventListener('tts-state', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          setSharedTts({ username: d.username, color: d.color, playing: d.playing, paused: d.paused, pageNumber: d.pageNumber, wordIndex: d.wordIndex, speed: d.speed })
        } catch {}
      })
      es.addEventListener('cursors', (e) => {
        try {
          const arr: any[] = JSON.parse((e as MessageEvent).data)
          for (const c of arr) addRemoteCursor(c.username, c)
        } catch {}
      })
      es.addEventListener('pages', (e) => {
        try {
          const arr: any[] = JSON.parse((e as MessageEvent).data)
          for (const p of arr) setRemotePage(p.username, p.pageNumber)
        } catch {}
      })
      es.addEventListener('page-change', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          if (d.username !== userRef.current) setRemotePage(d.username, d.pageNumber)
        } catch {}
      })
      es.addEventListener('follow-mode', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          if (d.leaderUsername !== userRef.current && d.enabled) setFollowMode(true)
        } catch {}
      })
    }

    const connect = async () => {
      if (closedRef.current) return
      const sid = sessionIdRef.current
      const uname = userRef.current
      if (!sid || !uname) return

      // Security fix: exchange the long-lived Bearer JWT for a short-lived
      // (60s) SSE ticket before opening the EventSource. This keeps the
      // 7-day token out of URL query strings (server logs, browser history,
      // Referer headers). The ticket is scoped to this session.
      let ticket: string | null = null
      try {
        const res = await authFetch(`/api/share/session/${sid}/ticket`, { method: 'POST' })
        if (res.ok) {
          const data = await res.json().catch(() => null)
          ticket = data?.ticket ?? null
        }
      } catch {}
      if (!ticket || closedRef.current) return

      const es = new EventSource(`/api/share/session/${sid}/events?ticket=${encodeURIComponent(ticket)}`)
      esRef.current = es

      es.addEventListener('open', () => {
        retryRef.current = 0
      })

      es.addEventListener('error', () => {
        es.close()
        esRef.current = null
        if (closedRef.current) return
        const delay = Math.min(MAX_RETRY_MS, 1000 * Math.pow(2, retryRef.current))
        retryRef.current = Math.min(retryRef.current + 1, 6)
        reconnectTimerRef.current = setTimeout(connect, delay)
      })

      attach(es)
    }

    connect()

    cursorTimerRef.current = setInterval(() => {
      const st = usePDFStore.getState()
      const sid = st.shareSession?._id
      if (!sid) return
      const pos = { x: st.mouseX, y: st.mouseY, page: st.currentPage }
      const last = lastSentPosRef.current
      if (last && last.x === pos.x && last.y === pos.y && last.page === pos.page) return
      lastSentPosRef.current = pos
      authFetch(`/api/share/session/${sid}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cursor', data: { pageNumber: pos.page, x: pos.x, y: pos.y } }),
      }).catch(() => {})
    }, CURSOR_INTERVAL_MS)

    return () => {
      closedRef.current = true
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
      esRef.current?.close()
      esRef.current = null
      if (cursorTimerRef.current) { clearInterval(cursorTimerRef.current); cursorTimerRef.current = null }
    }
  }, [sessionId, user?.username, setShareSession, setSharedAnnotations, addSharedComment, setSharedBookmarks, setSharedFlashcards, setSharedQuotes, removeSharedBookmark, removeSharedFlashcard, removeSharedQuote, addRemoteCursor, setRemotePage, setFollowMode, setSharedTimer, setSharedTts, addSessionChatMessage])

  const currentPage = usePDFStore((s) => s.currentPage)
  const prevPageRef = useRef(currentPage)
  useEffect(() => {
    if (!sessionId || !user?.username || prevPageRef.current === currentPage) return
    prevPageRef.current = currentPage
    authFetch(`/api/share/session/${sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'page-change', data: { pageNumber: currentPage } }),
    }).catch(() => {})
  }, [currentPage, sessionId, user?.username])
}
