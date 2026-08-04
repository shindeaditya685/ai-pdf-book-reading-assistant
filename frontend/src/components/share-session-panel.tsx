'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Users,
  Copy,
  Plus,
  LogIn,
  Trash2,
  MessageSquare,
  AtSign,
  Check,
  Loader2,
  RefreshCw,
  Timer,
  Volume2,
  UserCheck,
  Send,
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  Highlighter,
  Bookmark,
  Brain,
  Quote,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { usePDFStore, type ShareSession } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'

const FALLBACK_COLOR = '#3B82F6'

/** Pick a readable ink color for a colored fill by measuring relative luminance. */
function contrastText(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return '#ffffff'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 150 ? '#1c1917' : '#ffffff'
}

function MemberAvatar({
  name,
  color,
  size = 24,
  ring = false,
  className,
}: {
  name: string
  color?: string
  size?: number
  ring?: boolean
  className?: string
}) {
  const bg = color || FALLBACK_COLOR
  return (
    <div
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        ring && 'ring-2 ring-background',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: contrastText(bg),
        fontSize: Math.max(9, Math.round(size * 0.42)),
      }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

/** Signature element: every reader's position in the book. */
function ReadingPositionStrip({
  members,
  remotePages,
  currentPage,
  totalPages,
}: {
  members: { username: string; color: string }[]
  remotePages: Record<string, number>
  currentPage: number
  totalPages: number
}) {
  const last = Math.max(1, totalPages - 1)
  const pct = (page: number) => Math.min(100, Math.max(0, ((page - 1) / last) * 100))
  const online = members.filter((m) => remotePages[m.username] !== undefined)

  return (
    <div className="space-y-2">
      <div className="relative h-[7px] rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand/50 motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${pct(currentPage)}%` }}
        />
        {online.map((m) => {
          const page = remotePages[m.username]
          const left = `calc(${pct(page)}% - 7px)`
          return (
            <div
              key={m.username}
              title={`${m.username} — p.${page}`}
              className="absolute -top-[4px] h-[15px] w-[15px] rounded-full border-2 border-background shadow-sm motion-safe:transition-[left] motion-safe:duration-500"
              style={{ left, backgroundColor: m.color }}
            />
          )
        })}
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/70">
        <span>1</span>
        <span className="font-semibold text-foreground/80 tabular-nums">you · p.{currentPage}</span>
        <span>{totalPages}</span>
      </div>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  )
}

export function ShareSessionPanel() {
  const {
    showSharePanel,
    toggleSharePanel,
    shareSession,
    shareSessions,
    setShareSession,
    setSharedAnnotations,
    addSharedComment,
    setShareSessions,
    clearShareState,
    sharedAnnotations,
    sharedBookmarks,
    sharedFlashcards,
    sharedQuotes,
    setSharedBookmarks,
    setSharedFlashcards,
    setSharedQuotes,
    addSharedQuote,
    removeSharedQuote,
    quotes,
    pdfFileName,
    currentPage,
    totalPages,
    setPdfDataUrl,
    setPdfFileName,
    setCurrentPage,
    clearOcrText,
    bookmarks,
    flashcards,
    remotePages,
    followMode,
    setFollowMode,
    sessionChat,
    sharedTimer,
    sharedTts,
  } = usePDFStore()

  const { user } = useAuth()
  const [tab, setTab] = useState<'sessions' | 'session'>('sessions')
  const [sessionName, setSessionName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [copied, setCopied] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentingOn, setCommentingOn] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'annotations' | 'bookmarks' | 'flashcards' | 'quotes' | 'chat'>('annotations')
  const [chatText, setChatText] = useState('')
  const [sendingChat, setSendingChat] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/share/session')
      if (res.ok) setShareSessions(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [setShareSessions])

  const syncExistingDataToSession = async (sessionId: string) => {
    const promises: Promise<void>[] = []

    for (const bm of bookmarks) {
      promises.push(
        authFetch('/api/share/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: bm.id,
            sessionId,
            word: bm.word,
            meaning: bm.meaning,
            pronunciation: bm.pronunciation,
            translation: bm.translation,
            sentence: bm.sentence,
            pageNumber: bm.pageNumber,
            pdfFileName: bm.pdfFileName,
          }),
        }).then(() => {}),
      )
    }

    for (const fc of flashcards) {
      promises.push(
        authFetch('/api/share/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: fc._id || fc.id,
            sessionId,
            word: fc.word,
            meaning: fc.meaning,
            pronunciation: fc.pronunciation,
            translation: fc.translation,
            sentence: fc.sentence,
            pageNumber: fc.pageNumber,
            pdfFileName: fc.pdfFileName,
          }),
        }).then(() => {}),
      )
    }

    for (const q of quotes) {
      if (q.pdfFileName !== pdfFileName) continue
      promises.push(
        authFetch('/api/share/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: q.id,
            sessionId,
            text: q.text,
            context: q.context,
            noteText: q.noteText,
            pageNumber: q.pageNumber,
            pdfFileName: q.pdfFileName,
            rects: q.rects,
            color: q.color,
          }),
        }).then(() => {}),
      )
    }

    await Promise.allSettled(promises)
  }

  useEffect(() => {
    if (showSharePanel) {
      loadSessions()
      if (!shareSession) setTab('sessions')
    }
  }, [showSharePanel, loadSessions, shareSession])

  const handleCreate = async () => {
    if (!sessionName.trim()) {
      toast.error('Enter a circle name first')
      return
    }
    if (!pdfFileName) {
      toast.error('Open a PDF first to start a circle')
      return
    }
    setCreating(true)
    try {
      const res = await authFetch('/api/share/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName.trim(), pdfFileName }),
      })
      if (res.ok) {
        const session = await res.json()
        setShareSession(session)
        setTab('session')
        setSessionName('')
        loadSessions()
        syncExistingDataToSession(session._id)
        toast.success('Circle started')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || `Couldn’t start the circle (${res.status})`)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Network error — please try again')
    }
    setCreating(false)
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast.error('Enter a code first')
      return
    }
    setJoining(true)
    try {
      const res = await authFetch(`/api/share/session?code=${encodeURIComponent(inviteCode.trim())}`)
      if (res.ok) {
        const session = await res.json()
        if (session) {
          const joinRes = await authFetch(`/api/share/session/${session._id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'join', inviteCode: inviteCode.trim().toUpperCase() }),
          })
          if (joinRes.ok) {
            const updated = await joinRes.json()
            setShareSession(updated)
            setTab('session')
            setInviteCode('')
            loadSessions()
            syncExistingDataToSession(updated._id)
            toast.success('Joined the circle')
          } else {
            const err = await joinRes.json().catch(() => ({}))
            toast.error(err.error || `Failed to join (${joinRes.status})`)
          }
        } else {
          toast.error('No circle found with that code')
        }
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || `Couldn’t look up that code (${res.status})`)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Network error — please try again')
    }
    setJoining(false)
  }

  const handleLeave = async () => {
    if (!shareSession) return
    try {
      const res = await authFetch(`/api/share/session/${shareSession._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      })
      if (!res.ok) {
        toast.error('Failed to leave the circle')
        return
      }
      toast.success('Left the circle')
      clearShareState()
      setTab('sessions')
      loadSessions()
    } catch {
      toast.error('Network error — could not leave')
    }
  }

  const handleDelete = async () => {
    if (!shareSession) return
    try {
      await authFetch(`/api/share/session/${shareSession._id}`, { method: 'DELETE' })
      clearShareState()
      setTab('sessions')
      loadSessions()
    } catch { /* ignore */ }
  }

  const openSession = async (session: ShareSession) => {
    setShareSession(session)
    setTab('session')
    setSubTab('annotations')
    setSharedAnnotations([])
    await Promise.all([
      loadAnnotations(session._id),
      loadSharedBookmarks(session._id),
      loadSharedFlashcards(session._id),
      loadSharedQuotes(session._id),
    ])
  }

  const loadSharedPdf = async () => {
    if (!shareSession) return
    setLoadingPdf(true)
    try {
      setPdfDataUrl(null)
      setPdfFileName(null)
      clearOcrText()

      const res = await authFetch(`/api/db/pdf?sessionId=${encodeURIComponent(shareSession._id)}`)
      if (res.ok) {
        const pdf = await res.json()
        if (pdf?.content) {
          setCurrentPage(1)
          setPdfFileName(pdf.fileName)
          setTimeout(() => setPdfDataUrl(pdf.content), 50)
        }
      }
    } catch { /* ignore */ }
    setLoadingPdf(false)
  }

  const loadAnnotations = async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/share/annotations?sessionId=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        setSharedAnnotations(data)
      }
    } catch { /* ignore */ }
  }

  const refreshAnnotations = () => {
    if (shareSession) {
      loadAnnotations(shareSession._id)
      loadSharedBookmarks(shareSession._id)
      loadSharedFlashcards(shareSession._id)
      loadSharedQuotes(shareSession._id)
    }
  }

  const loadSharedBookmarks = async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/share/bookmarks?sessionId=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        setSharedBookmarks(data)
      }
    } catch { /* ignore */ }
  }

  const loadSharedFlashcards = async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/share/flashcards?sessionId=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        setSharedFlashcards(data)
      }
    } catch { /* ignore */ }
  }

  const loadSharedQuotes = async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/share/quotes?sessionId=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        setSharedQuotes(data)
      }
    } catch { /* ignore */ }
  }

  const handleAddComment = async (annotationId: string) => {
    if (!commentText.trim() || !shareSession) return
    try {
      const res = await authFetch(`/api/share/annotations/${annotationId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: shareSession._id, text: commentText.trim() }),
      })
      if (res.ok) {
        const comment = await res.json()
        addSharedComment(annotationId, comment)
        setCommentText('')
        setCommentingOn(null)
      }
    } catch { /* ignore */ }
  }

  const copyInviteCode = () => {
    if (shareSession) {
      navigator.clipboard.writeText(shareSession.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSendChat = useCallback(async () => {
    if (!chatText.trim() || !shareSession || sendingChat) return
    setSendingChat(true)
    try {
      const res = await authFetch(`/api/share/session/${shareSession._id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatText.trim() }),
      })
      if (res.ok) setChatText('')
    } catch {} finally { setSendingChat(false) }
  }, [chatText, shareSession, sendingChat])

  const handleReact = useCallback(async (annotationId: string, emoji: string) => {
    if (!shareSession) return
    try {
      await authFetch(`/api/share/annotations/${annotationId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: shareSession._id, emoji }),
      })
    } catch {}
  }, [shareSession])

  const handleTimerAction = useCallback(async (action: string, mode?: string) => {
    if (!shareSession) return
    try {
      await authFetch(`/api/share/session/${shareSession._id}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, mode }),
      })
    } catch {}
  }, [shareSession])

  const handleFollowToggle = useCallback(async () => {
    if (!shareSession) return
    const newState = !followMode
    setFollowMode(newState)
    await authFetch(`/api/share/session/${shareSession._id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'follow-mode', data: { enabled: newState } }),
    }).catch(() => {})
  }, [shareSession, followMode, setFollowMode])

  if (!showSharePanel) return null

  const timerRemaining = sharedTimer?.isRunning && sharedTimer?.startedAt
    ? Math.max(0, sharedTimer.totalMs - (Date.now() - new Date(sharedTimer.startedAt).getTime()))
    : 0
  const timerDisplay = sharedTimer
    ? `${Math.floor(timerRemaining / 60000)}:${String(Math.floor((timerRemaining % 60000) / 1000)).padStart(2, '0')}`
    : null

  const tabs = [
    { key: 'annotations' as const, label: 'Annotations', icon: Highlighter, count: sharedAnnotations.length },
    { key: 'bookmarks' as const, label: 'Bookmarks', icon: Bookmark, count: sharedBookmarks.length },
    { key: 'flashcards' as const, label: 'Flashcards', icon: Brain, count: sharedFlashcards.length },
    { key: 'quotes' as const, label: 'Quotes', icon: Quote, count: sharedQuotes.length },
    { key: 'chat' as const, label: 'Chat', icon: MessageCircle, count: sessionChat.length },
  ]

  return (
    <ResponsivePanel
      open={showSharePanel}
      onClose={toggleSharePanel}
      ariaLabel="Collaborative Reading"
      className="w-96"
      header={
        <PanelHeader
          icon={Users}
          title="Reading Room"
          onClose={toggleSharePanel}
        />
      }
    >
      <div className="panel-scrollbar flex-1 overflow-auto">
        {tab === 'sessions' || !shareSession ? (
          <div className="space-y-5 p-4">
            {/* Room introduction */}
            <div className="space-y-1.5">
              <SectionLabel>Reading room</SectionLabel>
              <h2 className="font-serif text-2xl font-semibold leading-tight tracking-tight">Read together.</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Start a circle for the book you’re reading, or join one with a friend’s code.
              </p>
            </div>

            {/* Start a circle */}
            <div className="space-y-2 rounded-2xl border border-brand/20 bg-brand-soft/30 p-3.5">
              <SectionLabel>Start a circle</SectionLabel>
              <div className="flex gap-2">
                <input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Name your circle…"
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !sessionName.trim() || !pdfFileName}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Start
                </button>
              </div>
              {!pdfFileName && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <Bookmark className="h-3 w-3" /> Open a PDF first to start a circle.
                </p>
              )}
            </div>

            {/* Join with a code */}
            <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-3.5">
              <SectionLabel>Join with a code</SectionLabel>
              <div className="flex gap-2">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="6-letter code"
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm font-bold uppercase tracking-[0.2em] outline-none focus:ring-2 focus:ring-brand/40"
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button
                  onClick={handleJoin}
                  disabled={joining || inviteCode.length < 4}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-xs font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                  Join
                </button>
              </div>
            </div>

            {/* My circles */}
            <div className="space-y-2">
              <SectionLabel>Your circles</SectionLabel>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                </div>
              ) : shareSessions.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No circles yet"
                  hint="Start one above, or ask a friend for their code."
                />
              ) : (
                <div className="space-y-2">
                  {shareSessions.map((s) => (
                    <button
                      key={s._id}
                      onClick={() => openSession(s)}
                      className="group w-full rounded-xl border border-border/70 bg-card p-3 text-left transition-colors hover:border-brand/30 hover:bg-muted/40"
                    >
                      <p className="truncate font-serif text-sm font-semibold text-foreground">{s.name}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="flex -space-x-1">
                          {s.members.slice(0, 4).map((m) => (
                            <MemberAvatar key={m.username} name={m.username} color={m.color} size={16} ring />
                          ))}
                        </div>
                        <span>
                          {s.members.length} member{s.members.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="font-mono text-[10px] tracking-wider">{s.inviteCode}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* Room identity */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => setTab('sessions')}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Back to your circles"
                aria-label="Back to your circles"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <SectionLabel>Reading circle</SectionLabel>
                <h2 className="truncate font-serif text-lg font-semibold leading-tight tracking-tight">
                  {shareSession.name}
                </h2>
              </div>
              <button
                onClick={copyInviteCode}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2 py-1.5 font-mono text-[11px] font-bold tracking-[0.15em] text-foreground transition-colors hover:border-brand/40"
                title="Copy invite code"
              >
                {shareSession.inviteCode}
                {copied ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
              </button>
            </div>

            {/* Readers + live signal */}
            <div className="flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {shareSession.members.map((m) => (
                  <MemberAvatar key={m.username} name={m.username} color={m.color} size={26} ring />
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </div>
            </div>

            {/* Signature: reading position strip */}
            <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <ReadingPositionStrip
                members={shareSession.members}
                remotePages={remotePages}
                currentPage={currentPage}
                totalPages={totalPages}
              />
            </div>

            {/* Open shared PDF (only when on a different file) */}
            {pdfFileName !== shareSession.pdfFileName && (
              <div>
                <button
                  onClick={loadSharedPdf}
                  disabled={loadingPdf}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-xs font-semibold text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-60 active:scale-[0.99]"
                >
                  {loadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BookOpenIcon />
                  )}
                  {loadingPdf ? 'Opening…' : 'Open the shared book'}
                </button>
                <p className="mt-1 text-center text-[10px] text-muted-foreground/60">
                  You’re on a different file from the circle.
                </p>
              </div>
            )}

            {/* Room controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleFollowToggle}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  followMode
                    ? 'bg-brand-soft text-brand ring-1 ring-brand/30 dark:text-brand'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
                title={followMode ? 'Following the circle leader' : 'Follow the circle leader'}
              >
                <UserCheck className="h-3.5 w-3.5" />
                {followMode ? 'Following' : 'Follow'}
              </button>

              {sharedTimer ? (
                <div className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                  <Timer className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-mono tabular-nums">{timerDisplay}</span>
                  {!sharedTimer.isRunning ? (
                    <button onClick={() => handleTimerAction('resume')} className="ml-0.5 text-brand hover:opacity-80" title="Resume timer">
                      <Play className="h-3 w-3" />
                    </button>
                  ) : (
                    <button onClick={() => handleTimerAction('pause')} className="ml-0.5 text-brand hover:opacity-80" title="Pause timer">
                      <Pause className="h-3 w-3" />
                    </button>
                  )}
                  <button onClick={() => handleTimerAction('reset')} className="text-muted-foreground/60 hover:text-destructive" title="Reset timer">
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleTimerAction('start', 'focus')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  title="Start a 25-minute focus timer"
                >
                  <Timer className="h-3.5 w-3.5 text-amber-500" />
                  25:00
                </button>
              )}

              {sharedTts?.playing && (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand dark:text-brand">
                  <Volume2 className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" />
                  {sharedTts.username} reading
                </div>
              )}
            </div>

            {/* Everyone here */}
            <section className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel>Readers ({shareSession.members.length})</SectionLabel>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-brand">
                  <WifiDot /> Live
                </span>
              </div>
              <div className="space-y-1.5">
                {shareSession.members.map((m) => {
                  const isCreator = m.username === shareSession.createdBy
                  const isMe = m.username === user?.username
                  const remotePage = remotePages[m.username]
                  const isOnline = remotePages[m.username] !== undefined
                  return (
                    <div key={m.username} className="flex items-center gap-2">
                      <MemberAvatar name={m.username} color={m.color} size={24} />
                      <span className="min-w-0 truncate text-xs text-foreground">
                        {m.username}
                        {isMe && <span className="text-muted-foreground/60"> · you</span>}
                      </span>
                      {isCreator && (
                        <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Host
                        </span>
                      )}
                      {remotePage !== undefined ? (
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                          p.{remotePage}
                        </span>
                      ) : (
                        <span className="ml-auto text-[10px] text-muted-foreground/40">offline</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex gap-2 border-t border-border/50 pt-3">
                {user?.username === shareSession.createdBy ? (
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    End circle
                  </button>
                ) : (
                  <button
                    onClick={handleLeave}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <LogIn className="h-3.5 w-3.5 rotate-180" />
                    Leave circle
                  </button>
                )}
              </div>
            </section>

            {/* Shared content */}
            <section className="space-y-3">
              <div className="sticky top-0 z-10 -mx-1 bg-background/90 px-1 pt-0.5 pb-1 backdrop-blur-sm">
                <div className="flex gap-0.5 overflow-x-auto rounded-xl bg-muted/50 p-0.5 no-scrollbar">
                  {tabs.map((t) => {
                    const Icon = t.icon
                    const active = subTab === t.key
                    return (
                      <button
                        key={t.key}
                        onClick={() => setSubTab(t.key)}
                        className={cn(
                          'flex flex-1 shrink-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors',
                          active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="max-w-[64px] truncate">{t.label}</span>
                        <span className={cn('tabular-nums', active ? 'text-brand' : 'text-muted-foreground/60')}>
                          {t.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={refreshAnnotations} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60 transition-colors hover:text-brand" title="Refresh">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>

              {subTab === 'annotations' && (
                sharedAnnotations.length === 0 ? (
                  <EmptyState
                    icon={Highlighter}
                    title="Nothing shared yet"
                    hint="Highlights and notes the group leaves on the page will appear here."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {sharedAnnotations.map((ann) => {
                      const author = shareSession.members.find((m) => m.username === ann.author)
                      const memberColor = author?.color || ann.color || FALLBACK_COLOR
                      return (
                        <article
                          key={ann.annotationId}
                          className="rounded-xl border border-border/60 bg-card/60"
                          style={{ borderLeft: `3px solid ${memberColor}` }}
                        >
                          <div className="space-y-2 p-3">
                            <div className="flex items-center gap-2">
                              <MemberAvatar name={ann.author} color={memberColor} size={20} />
                              <span className="text-xs font-semibold" style={{ color: memberColor }}>
                                {ann.author}
                              </span>
                              <span className="ml-auto font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                                p.{ann.pageNumber} · {ann.type}
                              </span>
                            </div>
                            {ann.noteText && (
                              <p className="rounded-lg bg-muted/40 px-2.5 py-1.5 font-serif text-[13px] leading-relaxed text-foreground/90">
                                {ann.noteText}
                              </p>
                            )}
                            {ann.rects && ann.rects.length > 0 && (
                              <p className="text-[10px] text-muted-foreground/60">
                                {ann.rects.length} highlight region{ann.rects.length > 1 ? 's' : ''}
                              </p>
                            )}

                            {/* Reactions */}
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {['👍', '❤️', '😮', '🎉', '👏'].map((emoji) => {
                                const users = ((ann as any).reactions || {})[emoji] || []
                                const hasReacted = users.includes(user?.username || '')
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReact(ann.annotationId, emoji)}
                                    className={cn(
                                      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-colors',
                                      hasReacted ? 'bg-brand-soft ring-1 ring-brand/30' : 'hover:bg-muted/60'
                                    )}
                                  >
                                    <span className="text-[13px] leading-none">{emoji}</span>
                                    {users.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground tabular-nums">{users.length}</span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>

                            {/* Comments */}
                            <div className="space-y-2 border-t border-border/50 bg-muted/20 px-0.5 pt-2">
                              {ann.comments.map((c) => {
                                const commentAuthor = shareSession.members.find((m) => m.username === c.author)
                                return (
                                  <div key={c.id} className="flex items-start gap-1.5 text-xs leading-relaxed">
                                    <span className="font-semibold" style={{ color: commentAuthor?.color || '#888' }}>
                                      {c.author}
                                    </span>
                                    <span className="text-foreground">
                                      {c.text.split(/(@\w+)/g).map((part, i) =>
                                        part.startsWith('@') ? (
                                          <span key={i} className="font-semibold text-brand">{part}</span>
                                        ) : part
                                      )}
                                    </span>
                                  </div>
                                )
                              })}
                              {commentingOn === ann.annotationId ? (
                                <div className="flex gap-1.5 pt-1">
                                  <input
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Write a comment… (@name to mention)"
                                    className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-brand/40"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleAddComment(ann.annotationId)
                                      }
                                      if (e.key === 'Escape') setCommentingOn(null)
                                    }}
                                  />
                                  <button
                                    onClick={() => handleAddComment(ann.annotationId)}
                                    disabled={!commentText.trim()}
                                    className="inline-flex h-8 items-center justify-center rounded-lg bg-brand px-2.5 text-brand-fg disabled:opacity-40"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setCommentingOn(ann.annotationId); setCommentText('') }}
                                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {ann.comments.length > 0 ? `${ann.comments.length} comment${ann.comments.length > 1 ? 's' : ''} · ` : ''}Add comment
                                  <AtSign className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )
              )}

              {subTab === 'bookmarks' && (
                sharedBookmarks.length === 0 ? (
                  <EmptyState
                    icon={Bookmark}
                    title="No shared words yet"
                    hint="Bookmark a word in the reader and it’ll appear here for the group."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {sharedBookmarks.map((bm) => {
                      const member = shareSession.members.find((m) => m.username === bm.author)
                      const color = member?.color || FALLBACK_COLOR
                      return (
                        <article key={bm.bookmarkId} className="rounded-xl border border-border/70 bg-card/60" style={{ borderLeft: `3px solid ${color}` }}>
                          <div className="space-y-1.5 p-3">
                            <div className="flex items-baseline gap-2">
                              <span className="font-serif text-lg font-semibold leading-tight" style={{ color }}>
                                {bm.word}
                              </span>
                              {bm.translation && (
                                <span className="text-xs text-muted-foreground/70">→ {bm.translation}</span>
                              )}
                            </div>
                            {bm.meaning && (
                              <p className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs leading-relaxed text-foreground/90">{bm.meaning}</p>
                            )}
                            {bm.sentence && (
                              <p className="font-serif text-[13px] italic leading-snug text-muted-foreground/80">“{bm.sentence}”</p>
                            )}
                            <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground/60">
                              <MemberAvatar name={bm.author} color={color} size={16} />
                              <span>{bm.author}</span>
                              <span className="font-mono tabular-nums">· p.{bm.pageNumber}</span>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )
              )}

              {subTab === 'flashcards' && (
                sharedFlashcards.length === 0 ? (
                  <EmptyState
                    icon={Brain}
                    title="No shared flashcards yet"
                    hint="Flashcards the group creates from the reading will appear here."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {sharedFlashcards.map((fc) => {
                      const member = shareSession.members.find((m) => m.username === fc.author)
                      const color = member?.color || FALLBACK_COLOR
                      return (
                        <article key={fc.flashcardId} className="rounded-xl border border-border/70 bg-card/60" style={{ borderLeft: `3px solid ${color}` }}>
                          <div className="space-y-1.5 p-3">
                            <div className="flex items-baseline gap-2">
                              <span className="font-serif text-xl font-semibold leading-tight" style={{ color }}>
                                {fc.word}
                              </span>
                              {fc.translation && (
                                <span className="text-xs text-muted-foreground/70">→ {fc.translation}</span>
                              )}
                            </div>
                            {fc.meaning && (
                              <p className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs leading-relaxed text-foreground/90">{fc.meaning}</p>
                            )}
                            {fc.sentence && (
                              <p className="font-serif text-[13px] italic leading-snug text-muted-foreground/80">“{fc.sentence}”</p>
                            )}
                            <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground/60">
                              <MemberAvatar name={fc.author} color={color} size={16} />
                              <span>{fc.author}</span>
                              <span className="font-mono tabular-nums">· p.{fc.pageNumber}</span>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )
              )}

              {subTab === 'quotes' && (
                <>
                  {quotes.filter((q) => q.pdfFileName === pdfFileName).length > 0 && (
                    <button
                      onClick={async () => {
                        const personalQuotes = quotes.filter((q) => q.pdfFileName === pdfFileName)
                        let imported = 0
                        for (const q of personalQuotes) {
                          const alreadyShared = sharedQuotes.some((sq) => sq.quoteId === q.id)
                          if (alreadyShared) continue
                          try {
                            const res = await authFetch('/api/share/quotes', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: q.id,
                                sessionId: shareSession._id,
                                text: q.text,
                                context: q.context,
                                noteText: q.noteText,
                                pageNumber: q.pageNumber,
                                pdfFileName: q.pdfFileName,
                                rects: q.rects,
                                color: q.color,
                              }),
                            })
                            if (res.ok) {
                              const data = await res.json()
                              addSharedQuote(data)
                              imported++
                            }
                          } catch {}
                        }
                        if (imported > 0) toast.success(`Imported ${imported} quote${imported > 1 ? 's' : ''} to the circle`)
                        else toast.message('No new quotes to import')
                      }}
                      className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500/10 px-3 py-2.5 text-xs font-semibold text-yellow-600 transition-colors hover:bg-yellow-500/20 dark:text-yellow-400"
                    >
                      <Quote className="h-3.5 w-3.5" />
                      Import your quotes ({quotes.filter((q) => q.pdfFileName === pdfFileName).length})
                    </button>
                  )}

                  {sharedQuotes.length === 0 ? (
                    <EmptyState
                      icon={Quote}
                      title="No shared quotes yet"
                      hint="Quotes the group saves from the reading will appear here."
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {sharedQuotes.map((q) => {
                        const member = shareSession.members.find((m) => m.username === q.author)
                        const color = member?.color || FALLBACK_COLOR
                        const canDelete = q.author === user?.username
                        return (
                          <article key={q.quoteId} className="rounded-xl border border-border/70 bg-card/60" style={{ borderLeft: `3px solid ${color}` }}>
                            <div className="space-y-1.5 p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold" style={{ color }}>{q.author}</span>
                                <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">p.{q.pageNumber}</span>
                                {canDelete && (
                                  <button
                                    onClick={async () => {
                                      const res = await authFetch(`/api/share/quotes?id=${encodeURIComponent(q.quoteId)}&sessionId=${encodeURIComponent(shareSession._id)}`, { method: 'DELETE' })
                                      if (res.ok) removeSharedQuote(q.quoteId)
                                    }}
                                    className="ml-auto text-muted-foreground/50 transition-colors hover:text-destructive"
                                    title="Delete quote"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <blockquote className="font-serif text-[15px] leading-snug text-foreground">
                                “{q.text}”
                              </blockquote>
                              {q.noteText && (
                                <p className="text-[11px] italic text-muted-foreground">Note: {q.noteText}</p>
                              )}
                              {q.context && (
                                <p className="text-[11px] leading-relaxed text-muted-foreground/70">{q.context}</p>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {subTab === 'chat' && (
                <div className="flex flex-col gap-2">
                  <div className="flex h-[400px] flex-col rounded-2xl border border-border/60 bg-card/40">
                    <div className="panel-scrollbar flex-1 space-y-2.5 overflow-auto p-3">
                      {sessionChat.length === 0 ? (
                        <EmptyState
                          icon={MessageCircle}
                          title="Not a word yet"
                          hint="Say hi — the circle reads better when the group talks."
                        />
                      ) : (
                        sessionChat.map((msg) => (
                          <div key={msg.id} className="flex items-start gap-2.5">
                            <MemberAvatar name={msg.username} color={msg.color} size={24} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs font-semibold" style={{ color: msg.color }}>{msg.username}</span>
                                <span className="font-mono text-[9px] text-muted-foreground/50">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="mt-0.5 text-sm leading-snug text-foreground/90">{msg.text}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 border-t border-border/50 p-2.5">
                      <input
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Type a message…"
                        className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                      />
                      <button
                        onClick={handleSendChat}
                        disabled={!chatText.trim() || sendingChat}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-40"
                        aria-label="Send message"
                      >
                        {sendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </ResponsivePanel>
  )
}

function BookOpenIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function WifiDot() {
  return (
    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 0 1 7.778 0M12 20h.01M12 12a8.5 8.5 0 0 1 5.333 1.889" />
    </svg>
  )
}