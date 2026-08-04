'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Quote as QuoteIcon, MessageSquare, Loader2, Plus, Trash2, Calendar, Hash, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import type { Quote, QuoteConversation } from '@/lib/quotes'

export default function QuoteChatsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<QuoteConversation[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    load()
     
  }, [user, authLoading, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [convsRes, quotesRes] = await Promise.all([
        authFetch('/api/quote-chat/conversations'),
        authFetch('/api/db/quotes'),
      ])
      const [convsData, quotesData] = await Promise.all([
        convsRes.ok ? convsRes.json() : { conversations: [] },
        quotesRes.ok ? quotesRes.json() : [],
      ])
      setConversations(Array.isArray(convsData.conversations) ? convsData.conversations : [])
      setQuotes(Array.isArray(quotesData) ? quotesData : [])
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [])

  const handleStartChat = useCallback(async () => {
    setCreating(true)
    try {
      const res = await authFetch('/api/quote-chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New quote chat', quoteIds: [] }),
      })
      const data = await res.json()
      if (data.success && data.conversation?.id) {
        router.push(`/quotes/chat/${data.conversation.id}`)
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false)
    }
  }, [router])

  const handleDelete = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirm(null)
    try {
      await authFetch(`/api/quote-chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {
      load()
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-paper-border bg-canvas/85 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm">
            <QuoteIcon className="h-3.5 w-3.5" />
          </div>
          <span className="font-serif text-base font-bold tracking-tight text-ink">Quote Chats</span>
          <span className="rounded-full bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
          </span>
        </div>
        <Link
          href="/quotes"
          className="hidden h-8 items-center gap-1.5 rounded-lg border border-paper-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-ink sm:inline-flex"
        >
          All Quotes
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── NEW CHAT ── */}
        <div className="mb-6 flex flex-col items-stretch gap-3 rounded-2xl border border-brand/25 bg-brand/5 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-base font-bold tracking-tight text-ink">Start a new conversation</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You have {quotes.length} saved quote{quotes.length === 1 ? '' : 's'} ready to chat with. Pick some from a quote in the library, or start empty and add quotes as you go.
            </p>
          </div>
          <button
            onClick={handleStartChat}
            disabled={creating}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50 sm:h-9 sm:px-3 sm:text-xs"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New chat
          </button>
        </div>

        {/* ── CONVERSATION LIST ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper-border bg-card shadow-sm">
              <MessageSquare className="h-6 w-6 text-brand/60" />
            </div>
            <div>
              <p className="font-serif text-lg font-bold tracking-tight text-ink">No quote chats yet</p>
              <p className="mt-0.5 max-w-sm text-xs text-muted-foreground/50">
                Start a chat to ask questions about your saved quotes, compare passages, or reflect on what you&apos;ve read
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => {
              const preview = quotes.find((q) => q.id === c.quoteIds[0])
              return (
                <div
                  key={c.id}
                  className="group flex items-start gap-3 rounded-xl border border-paper-border bg-card p-3 shadow-sm transition-all hover:border-brand/40 hover:shadow-md"
                >
                  <button
                    onClick={() => router.push(`/quotes/chat/${c.id}`)}
                    className="flex flex-1 items-start gap-3 min-w-0 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-sm font-bold tracking-tight text-ink">
                        {c.title || 'Untitled chat'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/60">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {c.quoteIds.length} quote{c.quoteIds.length === 1 ? '' : 's'}
                        </span>
                        {c.pdfFileNames.length > 0 && (
                          <span className="truncate">
                            {c.pdfFileNames.length} book{c.pdfFileNames.length === 1 ? '' : 's'}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {preview && (
                        <p className="mt-1.5 line-clamp-1 text-xs italic text-ink/60">
                          &ldquo;{preview.text.slice(0, 80)}{preview.text.length > 80 ? '…' : ''}&rdquo;
                        </p>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(c.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground/20 transition-colors hover:bg-red-500/5 hover:text-red-500"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── DELETE CONFIRMATION ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-paper-border bg-card p-6 shadow-2xl">
            <h3 className="font-serif text-sm font-bold tracking-tight text-ink">Delete this conversation?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This will permanently remove the chat and all its messages. Your saved quotes are not affected.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-paper-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}