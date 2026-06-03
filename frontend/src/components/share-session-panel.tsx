'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, Link2, Copy, Plus, LogIn, Trash2, MessageSquare, AtSign, Check, Loader2, UserPlus, RefreshCw } from 'lucide-react'
import { usePDFStore, type ShareSession, type SharedAnnotation, type SharedComment } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/auth-context'

export function ShareSessionPanel() {
  const {
    showSharePanel,
    toggleSharePanel,
    shareSession,
    shareSessions,
    setShareSession,
    setSharedAnnotations,
    addSharedAnnotation,
    addSharedComment,
    setShareSessions,
    clearShareState,
    sharedAnnotations,
    sharedBookmarks,
    sharedFlashcards,
    setSharedBookmarks,
    setSharedFlashcards,
    pdfFileName,
    currentPage,
    pdfDataUrl,
    setPdfDataUrl,
    setPdfFileName,
    setCurrentPage,
    clearOcrText,
  } = usePDFStore()

  const { user } = useAuth()
  const [tab, setTab] = useState<'sessions' | 'session'>('sessions')
  const [sessionName, setSessionName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentingOn, setCommentingOn] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'annotations' | 'bookmarks' | 'flashcards'>('annotations')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/share/session')
      if (res.ok) setShareSessions(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [setShareSessions])

  useEffect(() => {
    if (showSharePanel) loadSessions()
  }, [showSharePanel, loadSessions])

  const handleCreate = async () => {
    if (!sessionName.trim() || !pdfFileName) return
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
      }
    } catch { /* ignore */ }
    setCreating(false)
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setJoining(true)
    try {
      const res = await authFetch(`/api/share/session?code=${encodeURIComponent(inviteCode.trim())}`)
      if (res.ok) {
        const session = await res.json()
        if (session) {
          const joinRes = await authFetch(`/api/share/session/${session._id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'join' }),
          })
          if (joinRes.ok) {
            const updated = await joinRes.json()
            setShareSession(updated)
            setTab('session')
            setInviteCode('')
            loadSessions()
          }
        }
      }
    } catch { /* ignore */ }
    setJoining(false)
  }

  const handleLeave = async () => {
    if (!shareSession) return
    try {
      await authFetch(`/api/share/session/${shareSession._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      })
      clearShareState()
      setTab('sessions')
      loadSessions()
    } catch { /* ignore */ }
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
    ])
  }

  const loadSharedPdf = async () => {
    if (!shareSession) return
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

  if (!showSharePanel) return null

  const myColor = shareSession?.members.find((m) => m.username === user?.username)?.color

  return (
    <div className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-bold">Collaborative Reading</h2>
        </div>
        <button onClick={toggleSharePanel} className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'sessions' ? (
          <div className="p-4 space-y-4">
            {/* Create Session */}
            <div className="rounded-xl border border-border/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Create a Session</p>
              <div className="flex gap-2">
                <input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Session name..."
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !sessionName.trim()}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create
                </button>
              </div>
            </div>

            {/* Join Session */}
            <div className="rounded-xl border border-border/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Join with Code</p>
              <div className="flex gap-2">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter invite code..."
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-emerald-500"
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button
                  onClick={handleJoin}
                  disabled={joining || inviteCode.length < 4}
                  className="flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
                >
                  {joining ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
                  Join
                </button>
              </div>
            </div>

            {/* My Sessions */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">My Sessions</p>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                </div>
              ) : shareSessions.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-6">
                  No sessions yet. Create one or join with a code.
                </p>
              ) : (
                <div className="space-y-2">
                  {shareSessions.map((s) => (
                    <button
                      key={s._id}
                      onClick={() => openSession(s)}
                      className="w-full rounded-xl border border-border/60 p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{s.members.length} member{s.members.length !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span className="font-mono text-[10px]">{s.inviteCode}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : shareSession ? (
          <div className="p-4 space-y-4">
            {/* Session Header */}
            <div className="rounded-xl border border-border/60 p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{shareSession.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded font-bold tracking-wider">
                      {shareSession.inviteCode}
                    </span>
                    <button
                      onClick={copyInviteCode}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy invite code"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Load Shared PDF */}
              {pdfFileName !== shareSession.pdfFileName && (
                <div>
                  <button
                    onClick={loadSharedPdf}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors active:scale-[0.98]"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Open Shared PDF
                  </button>
                  <p className="mt-1 text-[9px] text-center text-muted-foreground/50">
                    Current: {pdfFileName ? pdfFileName.split('/').pop() : 'none'} · Session: {shareSession.pdfFileName.split('/').pop()}
                  </p>
                </div>
              )}

              {/* Members */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Members ({shareSession.members.length})
                </p>
                <div className="space-y-1.5">
                  {shareSession.members.map((m) => {
                    const isCreator = m.username === shareSession.createdBy
                    const isMe = m.username === user?.username
                    return (
                      <div key={m.username} className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="text-xs text-foreground">
                          {m.username}
                          {isMe && <span className="text-muted-foreground/50 ml-1">(you)</span>}
                        </span>
                        {isCreator && (
                          <span className="text-[9px] font-semibold text-muted-foreground/50 ml-auto">Creator</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {user?.username === shareSession.createdBy ? (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1 rounded-lg bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Session
                  </button>
                ) : (
                  <button
                    onClick={handleLeave}
                    className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogIn className="h-3 w-3 rotate-180" />
                    Leave Session
                  </button>
                )}
              </div>
            </div>

            {/* Shared Content Tabs */}
            <div>
              <div className="flex gap-0.5 mb-2 rounded-lg bg-muted/40 p-0.5">
                <button
                  onClick={() => setSubTab('annotations')}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    subTab === 'annotations' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Annotations ({sharedAnnotations.length})
                </button>
                <button
                  onClick={() => setSubTab('bookmarks')}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    subTab === 'bookmarks' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Bookmarks ({sharedBookmarks.length})
                </button>
                <button
                  onClick={() => setSubTab('flashcards')}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    subTab === 'flashcards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Flashcards ({sharedFlashcards.length})
                </button>
              </div>

              <button onClick={refreshAnnotations} className="ml-auto mb-2 flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-emerald-500 transition-colors" title="Refresh">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>

              {subTab === 'annotations' && (
                <>
                  {sharedAnnotations.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-6">
                      No shared annotations yet. Group members' highlights and notes will appear here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sharedAnnotations.map((ann) => {
                        const author = shareSession.members.find((m) => m.username === ann.author)
                        const memberColor = author?.color || ann.color
                        return (
                          <div key={ann.annotationId} className="rounded-xl border border-border/60 overflow-hidden">
                            <div className="p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: memberColor }} />
                                <span className="text-xs font-semibold" style={{ color: memberColor }}>
                                  {ann.author}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50 ml-auto">
                                  Pg {ann.pageNumber} · {ann.type}
                                </span>
                              </div>
                              {ann.noteText && (
                                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-2 py-1">
                                  {ann.noteText}
                                </p>
                              )}
                              {ann.rects && ann.rects.length > 0 && (
                                <p className="text-[10px] text-muted-foreground/50">
                                  {ann.rects.length} highlight region{ann.rects.length > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>

                            {/* Comments */}
                            <div className="border-t border-border/40 bg-muted/20 px-3 py-2 space-y-2">
                              {ann.comments.map((c) => {
                                const commentAuthor = shareSession.members.find((m) => m.username === c.author)
                                return (
                                  <div key={c.id} className="text-xs">
                                    <span
                                      className="font-semibold"
                                      style={{ color: commentAuthor?.color || '#888' }}
                                    >
                                      {c.author}
                                    </span>
                                    <span className="text-foreground ml-1">
                                      {c.text.split(/(@\w+)/g).map((part, i) =>
                                        part.startsWith('@') ? (
                                          <span key={i} className="text-emerald-500 font-semibold">{part}</span>
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
                                    placeholder="Write a comment... (@mention)"
                                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-emerald-500"
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
                                    className="rounded-lg bg-emerald-500 px-2 py-1 text-white disabled:opacity-50 hover:bg-emerald-600 transition-colors"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setCommentingOn(ann.annotationId); setCommentText('') }}
                                  className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {ann.comments.length > 0 ? `${ann.comments.length} comment${ann.comments.length > 1 ? 's' : ''} · ` : ''}
                                  Add comment
                                  <AtSign className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {subTab === 'bookmarks' && (
                <>
                  {sharedBookmarks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-6">
                      No shared bookmarks yet. Group members' word bookmarks will appear here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sharedBookmarks.map((bm) => {
                        const member = shareSession.members.find((m) => m.username === bm.author)
                        return (
                          <div key={bm.bookmarkId} className="rounded-xl border border-border/60 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: member?.color || '#888' }} />
                              <span className="text-xs font-semibold text-foreground">{bm.word}</span>
                              {bm.translation && (
                                <span className="text-xs text-muted-foreground/70">→ {bm.translation}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground/50 ml-auto">
                                {bm.author} · Pg {bm.pageNumber}
                              </span>
                            </div>
                            {bm.meaning && (
                              <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2 py-1 mt-1">{bm.meaning}</p>
                            )}
                            {bm.sentence && (
                              <p className="text-[11px] text-muted-foreground/60 italic mt-1">"{bm.sentence}"</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {subTab === 'flashcards' && (
                <>
                  {sharedFlashcards.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-6">
                      No shared flashcards yet. Group members' flashcards will appear here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sharedFlashcards.map((fc) => {
                        const member = shareSession.members.find((m) => m.username === fc.author)
                        return (
                          <div key={fc.flashcardId} className="rounded-xl border border-border/60 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: member?.color || '#888' }} />
                              <span className="text-xs font-semibold text-foreground">{fc.word}</span>
                              {fc.translation && (
                                <span className="text-xs text-muted-foreground/70">→ {fc.translation}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground/50 ml-auto">
                                {fc.author} · Pg {fc.pageNumber}
                              </span>
                            </div>
                            {fc.meaning && (
                              <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2 py-1 mt-1">{fc.meaning}</p>
                            )}
                            {fc.sentence && (
                              <p className="text-[11px] text-muted-foreground/60 italic mt-1">"{fc.sentence}"</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
