'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Loader2, Quote as QuoteIcon, Send, Sparkles, Trash2, X, Hash, Calendar, User, Bot, AlertCircle, Edit3, Save, Check, MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { QUOTE_LIMITS, truncate } from '@/lib/quotes'
import type { Quote, QuoteConversation, QuoteMessage, QuoteRefSnapshot } from '@/lib/quotes'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface HydratedQuote {
  id: string
  text: string
  noteText: string
  context: string
  pageNumber: number
  pdfFileName: string
  color: string
}

export default function QuoteChatDetailPage() {
  const { user, isLoading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const conversationId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : null

  const [conversation, setConversation] = useState<QuoteConversation | null>(null)
  const [messages, setMessages] = useState<QuoteMessage[]>([])
  const [pinnedQuotes, setPinnedQuotes] = useState<HydratedQuote[]>([])
  const [allQuotes, setAllQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [showPinPanel, setShowPinPanel] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [quotaModal, setQuotaModal] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load conversation + all quotes (for the pin panel) on mount
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (!conversationId) return
    load()
    loadAllQuotes()
     
  }, [user, authLoading, conversationId, router])

  const load = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/quote-chat/conversations/${encodeURIComponent(conversationId)}`)
      if (res.status === 404) {
        setError('Conversation not found')
        return
      }
      if (!res.ok) {
        setError(`Failed to load (${res.status})`)
        return
      }
      const data = await res.json()
      setConversation(data.conversation)
      setMessages(data.messages || [])
      setPinnedQuotes(data.quotes || [])
      setTitleDraft(data.conversation?.title || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  const loadAllQuotes = useCallback(async () => {
    try {
      const res = await authFetch('/api/db/quotes')
      if (res.ok) {
        const data = await res.json()
        setAllQuotes(Array.isArray(data) ? data : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Auto-scroll to the latest message on new ones
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length, sending])

  // Auto-grow textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`
    }
  }, [draft])

  const pinnedIds = useMemo(() => new Set(pinnedQuotes.map((q) => q.id)), [pinnedQuotes])

  const handleSend = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending || !conversationId) return
    setSending(true)
    setDraft('')
    try {
      const quoteRefs: QuoteRefSnapshot[] = pinnedQuotes.map((q) => ({
        quoteId: q.id,
        text: q.text,
        noteText: q.noteText,
        pageNumber: q.pageNumber,
        pdfFileName: q.pdfFileName,
      }))
      const res = await authFetch(`/api/quote-chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, quoteRefs }),
      })
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setQuotaModal(data?.error || 'Daily AI limit reached.')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || `AI call failed (${res.status})`)
        return
      }
      const data = await res.json()
      if (data.userMessage) setMessages((prev) => [...prev, data.userMessage])
      if (data.assistantMessage) setMessages((prev) => [...prev, data.assistantMessage])
      // Bump local conversation timestamp
      setConversation((c) => (c ? { ...c, updatedAt: Date.now() } : c))
      // Notify quota to refresh (the message consumed one slot)
      window.dispatchEvent(new CustomEvent('ai-quota-changed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSending(false)
    }
  }, [draft, sending, conversationId, pinnedQuotes])

  const handleSaveTitle = useCallback(async () => {
    if (!conversationId) return
    const title = titleDraft.trim()
    if (!title) {
      setEditingTitle(false)
      setTitleDraft(conversation?.title || '')
      return
    }
    try {
      const res = await authFetch(`/api/quote-chat/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (res.ok) {
        setConversation((c) => (c ? { ...c, title } : c))
        setEditingTitle(false)
      }
    } catch {
      /* ignore */
    }
  }, [conversationId, titleDraft, conversation?.title])

  const handleTogglePin = useCallback(async (quoteId: string) => {
    if (!conversationId) return
    const next = pinnedIds.has(quoteId)
      ? pinnedQuotes.map((q) => q.id).filter((id) => id !== quoteId)
      : pinnedQuotes.map((q) => q.id).concat(quoteId)
    try {
      const res = await authFetch(`/api/quote-chat/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteIds: next }),
      })
      if (res.ok) {
        const data = await res.json()
        setPinnedQuotes((prev) => {
          const ids = new Set(prev.map((q) => q.id))
          const target = allQuotes.find((q) => q.id === quoteId)
          if (!target) return prev
          const hydrated: HydratedQuote = {
            id: target.id,
            text: target.text,
            noteText: target.noteText,
            context: target.context || '',
            pageNumber: target.pageNumber,
            pdfFileName: target.pdfFileName,
            color: target.color || 'rgba(253, 224, 71, 0.65)',
          }
          if (next.includes(quoteId) && !ids.has(quoteId)) return [...prev, hydrated]
          return prev.filter((q) => q.id !== quoteId)
        })
        // Re-fetch to get authoritative pdfFileNames
        load()
      }
    } catch {
      /* ignore */
    }
  }, [conversationId, pinnedIds, pinnedQuotes, allQuotes, load])

  const handleDelete = useCallback(async () => {
    if (!conversationId) return
    try {
      await authFetch(`/api/quote-chat/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' })
      router.push('/quotes/chat')
    } catch {
      setError('Failed to delete conversation')
    }
  }, [conversationId, router])

  // Auto-title the conversation after the first user message
  useEffect(() => {
    if (!conversation || messages.length !== 1) return
    if (conversation.title && conversation.title !== 'New quote chat') return
    const first = messages[0]
    if (first.role !== 'user') return
    const suggested = truncate(first.content.replace(/\s+/g, ' ').trim(), 60) || 'New quote chat'
    if (suggested === conversation.title) return
    ;(async () => {
      try {
        const res = await authFetch(`/api/quote-chat/conversations/${encodeURIComponent(conversationId!)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: suggested }),
        })
        if (res.ok) {
          setConversation((c) => (c ? { ...c, title: suggested } : c))
          setTitleDraft(suggested)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [messages, conversation, conversationId])

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm font-semibold text-foreground">{error}</p>
        <div className="flex gap-2">
          <button
            onClick={() => load()}
            className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600 transition-colors"
          >
            Retry
          </button>
          <Link href="/quotes/chat" className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
            Back
          </Link>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return null
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      {/* ── HEADER ── */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-yellow-500/10 bg-background/80 px-3 shadow-sm backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/quotes/chat" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-md shadow-yellow-500/20 ring-1 ring-yellow-500/20">
            <QuoteIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value.slice(0, QUOTE_LIMITS.CHAT_TITLE_MAX))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle()
                    if (e.key === 'Escape') {
                      setEditingTitle(false)
                      setTitleDraft(conversation.title)
                    }
                  }}
                  autoFocus
                  className="h-7 max-w-[260px] flex-1 rounded-md border border-border/60 bg-background px-2 text-sm font-semibold text-foreground outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-500/30 sm:max-w-md"
                />
                <button
                  onClick={handleSaveTitle}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  title="Save title"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setEditingTitle(false)
                    setTitleDraft(conversation.title)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="group flex min-w-0 items-center gap-1.5 text-left"
                title="Click to rename"
              >
                <span className="truncate text-sm font-bold text-foreground">{conversation.title}</span>
                <Edit3 className="h-3 w-3 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
              </button>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <Hash className="h-2.5 w-2.5" />
                {pinnedQuotes.length} quote{pinnedQuotes.length === 1 ? '' : 's'}
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowPinPanel((p) => !p)}
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground sm:inline-flex"
            title="Toggle pinned quotes panel"
          >
            <QuoteIcon className="h-3.5 w-3.5" />
            {showPinPanel ? 'Hide' : 'Pins'}
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-red-50 hover:text-red-500"
            title="Delete conversation"
            aria-label="Delete conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ── BODY: chat + optional pin panel ── */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
            {messages.length === 0 ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 text-yellow-600 dark:text-yellow-400">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Ask about your quotes</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  {pinnedQuotes.length === 0
                    ? 'Pin a few quotes to give the AI context, then ask anything — compare passages, find themes, or get reflection prompts.'
                    : 'You can ask things like "How are these related?", "Which one resonates most with leadership?", or "Summarize the themes across these quotes."'}
                </p>
                {pinnedQuotes.length === 0 && (
                  <button
                    onClick={() => setShowPinPanel(true)}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-yellow-500 px-3 text-xs font-semibold text-white hover:bg-yellow-600 transition-colors"
                  >
                    <QuoteIcon className="h-3.5 w-3.5" />
                    Pin some quotes
                  </button>
                )}
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {sending && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-300">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-sm bg-yellow-500/10 px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking…
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-yellow-500/10 bg-background/80 px-3 py-3 backdrop-blur-xl sm:px-6">
            <div className="mx-auto max-w-2xl">
              {pinnedQuotes.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    Sending with:
                  </span>
                  {pinnedQuotes.slice(0, 4).map((q) => (
                    <span
                      key={q.id}
                      className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:text-yellow-300"
                      title={q.text}
                    >
                      <span className="truncate">&ldquo;{truncate(q.text, 30)}&rdquo;</span>
                    </span>
                  ))}
                  {pinnedQuotes.length > 4 && (
                    <span className="text-[10px] font-semibold text-muted-foreground/60">
                      +{pinnedQuotes.length - 4} more
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background p-2 shadow-sm focus-within:border-yellow-400 focus-within:ring-1 focus-within:ring-yellow-500/30">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, QUOTE_LIMITS.CHAT_MESSAGE_MAX))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={pinnedQuotes.length === 0 ? 'Pin some quotes first…' : 'Ask about your quotes…'}
                  rows={1}
                  disabled={sending || pinnedQuotes.length === 0}
                  className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim() || pinnedQuotes.length === 0}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-500 text-white shadow-sm transition-colors hover:bg-yellow-600 disabled:opacity-50"
                  title="Send (Enter)"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/50">
                <span>Enter to send · Shift+Enter for newline</span>
                <span className="tabular-nums">{draft.length}/{QUOTE_LIMITS.CHAT_MESSAGE_MAX}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pin panel (desktop only) */}
        {showPinPanel && (
          <aside className="hidden w-80 shrink-0 border-l border-border/40 bg-background/60 backdrop-blur-md lg:flex lg:flex-col">
            <div className="border-b border-border/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Pinned Quotes</h3>
                <button
                  onClick={() => setShowPinPanel(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Close pin panel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                These quotes are sent as context with every message. {QUOTE_LIMITS.PINNED_QUOTES_MAX} max.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {allQuotes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <QuoteIcon className="h-6 w-6 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/50">No saved quotes yet</p>
                  <Link
                    href="/dashboard"
                    className="text-[10px] font-semibold text-yellow-600 hover:underline"
                  >
                    Open a book and save some
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {allQuotes.map((q) => {
                    const isPinned = pinnedIds.has(q.id)
                    const overLimit = !isPinned && pinnedQuotes.length >= QUOTE_LIMITS.PINNED_QUOTES_MAX
                    return (
                      <button
                        key={q.id}
                        onClick={() => !overLimit && handleTogglePin(q.id)}
                        disabled={overLimit}
                        className={`group block w-full rounded-lg border p-2.5 text-left transition-colors ${
                          isPinned
                            ? 'border-yellow-500/50 bg-yellow-500/10'
                            : 'border-border/40 bg-background/40 hover:border-border/70'
                        } ${overLimit ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <p className="line-clamp-3 text-xs leading-relaxed text-foreground">
                          &ldquo;{q.text}&rdquo;
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground/50">
                          <span className="truncate">{q.pdfFileName.split('/').pop()} · p.{q.pageNumber}</span>
                          <span className="font-bold">
                            {isPinned ? (
                              <span className="text-yellow-600">Pinned</span>
                            ) : overLimit ? (
                              'Limit'
                            ) : (
                              <span className="opacity-0 group-hover:opacity-100">+ Pin</span>
                            )}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Mobile pin panel — slide up modal */}
        {showPinPanel && (
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-hidden rounded-t-2xl border-t border-border/40 bg-background/95 shadow-2xl backdrop-blur-md lg:hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Pinned Quotes</h3>
              <button
                onClick={() => setShowPinPanel(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Close pin panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {allQuotes.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground/50">No saved quotes yet</p>
              ) : (
                <div className="space-y-1.5">
                  {allQuotes.map((q) => {
                    const isPinned = pinnedIds.has(q.id)
                    const overLimit = !isPinned && pinnedQuotes.length >= QUOTE_LIMITS.PINNED_QUOTES_MAX
                    return (
                      <button
                        key={q.id}
                        onClick={() => !overLimit && handleTogglePin(q.id)}
                        disabled={overLimit}
                        className={`block w-full rounded-lg border p-2.5 text-left transition-colors ${
                          isPinned ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-border/40 bg-background/40'
                        } ${overLimit ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <p className="line-clamp-3 text-xs leading-relaxed text-foreground">
                          &ldquo;{q.text}&rdquo;
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground/50">
                          <span className="truncate">{q.pdfFileName.split('/').pop()} · p.{q.pageNumber}</span>
                          <span className="font-bold">
                            {isPinned ? <span className="text-yellow-600">Pinned</span> : overLimit ? 'Limit' : '+ Pin'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── DELETE CONFIRMATION ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">Delete this conversation?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This will permanently remove the chat and all its messages. Your saved quotes are not affected.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUOTA EXCEEDED MODAL ── */}
      {quotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">AI limit reached</h3>
            <p className="mt-1 text-xs text-muted-foreground">{quotaModal}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Upgrade to Pro for unlimited AI conversations.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setQuotaModal(null)}
                className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
              <Link
                href="/profile"
                onClick={() => setQuotaModal(null)}
                className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-600 transition-colors"
              >
                Upgrade
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: QuoteMessage }) {
  const isUser = message.role === 'user'
  const refs = message.quoteRefs || []

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={`flex max-w-[85%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {refs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              {refs.length} quote{refs.length === 1 ? '' : 's'} attached
            </span>
          </div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
            isUser
              ? 'rounded-tr-sm bg-emerald-500 text-white'
              : 'rounded-tl-sm bg-yellow-500/10 text-foreground'
          }`}
        >
          {message.content ? (
            <div className="markdown-content break-words text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <span className="italic text-muted-foreground/60">(empty)</span>
          )}
        </div>
        {refs.length > 0 && (
          <details className="group w-full max-w-md rounded-lg border border-border/40 bg-background/60 px-2.5 py-1.5 text-xs">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground">
              {refs.length} referenced quote{refs.length === 1 ? '' : 's'}
            </summary>
            <div className="mt-2 space-y-2">
              {refs.map((r) => (
                <div key={r.quoteId} className="rounded-md border border-border/30 bg-muted/30 p-2">
                  <p className="line-clamp-3 italic text-foreground">&ldquo;{r.text}&rdquo;</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                    <BookOpen className="h-2.5 w-2.5" />
                    <span className="truncate">{r.pdfFileName.split('/').pop()}</span>
                    <span>·</span>
                    <span>p.{r.pageNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        <span className="text-[9px] text-muted-foreground/40 tabular-nums">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
