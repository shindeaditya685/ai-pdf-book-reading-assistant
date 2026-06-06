'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, BookText, Clock, Hash, Loader2, Trash2, Search, BarChart3, Timer, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

interface BookInfo {
  fileName: string
  pageCount: number
  lastPage: number
  wordCount: number
  bookmarkCount: number
  totalPagesRead: number
  totalMinutes: number
  createdAt: string
  updatedAt: string
}

export default function LibraryPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<BookInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadBooks()
  }, [user, authLoading, router])

  const loadBooks = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/library')
      if (res.ok) {
        const data = await res.json()
        setBooks(data.books || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleDelete = async (fileName: string) => {
    const res = await authFetch(`/api/db/pdf?fileName=${encodeURIComponent(fileName)}`, { method: 'DELETE' })
    if (res.ok) {
      setBooks((prev) => prev.filter((b) => b.fileName !== fileName))
    }
    setDeleteConfirm(null)
  }

  const handleOpen = (fileName: string) => {
    router.push(`/dashboard?open=${encodeURIComponent(fileName)}`)
  }

  const filtered = books.filter((b) =>
    b.fileName.toLowerCase().includes(search.toLowerCase())
  )

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-emerald-500/10 bg-background/60 px-4 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 shadow-md shadow-amber-500/20 ring-1 ring-amber-500/20">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Library</span>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {books.length} books
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── STATS BAR ── */}
        {books.length > 0 && (
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Total Books</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{books.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Pages Read</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{books.reduce((s, b) => s + b.totalPagesRead, 0)}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Words Looked Up</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{books.reduce((s, b) => s + b.wordCount, 0)}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Reading Time</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{Math.round(books.reduce((s, b) => s + b.totalMinutes, 0) / 60)}h</p>
            </div>
          </div>
        )}

        {/* ── SEARCH ── */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your books..."
            className="h-10 w-full max-w-md rounded-lg border border-border/60 bg-background/80 pl-9 pr-3 text-base outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/15 sm:h-9 sm:text-sm"
          />
        </div>

        {/* ── BOOK GRID ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-muted-foreground/50">
              {search ? 'No books match your search' : 'No books yet'}
            </p>
            <p className="text-xs text-muted-foreground/40">Upload a PDF to start building your library</p>
            {!search && (
              <Link href="/dashboard" className="mt-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors">
                Go to Dashboard
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((book) => {
              const progress = book.pageCount > 0 ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100)) : 0
              return (
                <div
                  key={book.fileName}
                  className="group relative rounded-xl border border-border/60 bg-background/60 shadow-sm backdrop-blur-sm transition-all hover:border-amber-200 hover:shadow-md dark:hover:border-amber-800/30"
                >
                  <button
                    onClick={() => handleOpen(book.fileName)}
                    className="w-full p-4 text-left"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10">
                        <BookText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{book.fileName.split('/').pop() || book.fileName}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                          Added {new Date(book.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/20 group-hover:text-amber-500 transition-colors" />
                    </div>

                    {/* Stats */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-muted/30 p-2 text-center">
                        <p className="text-xs font-bold text-foreground tabular-nums">{book.wordCount}</p>
                        <p className="text-[9px] text-muted-foreground/50">Words</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2 text-center">
                        <p className="text-xs font-bold text-foreground tabular-nums">{book.bookmarkCount}</p>
                        <p className="text-[9px] text-muted-foreground/50">Bookmarks</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2 text-center">
                        <p className="text-xs font-bold text-foreground tabular-nums">{book.totalMinutes}m</p>
                        <p className="text-[9px] text-muted-foreground/50">Read</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {book.pageCount > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
                          <span className="flex items-center gap-1">
                            <BarChart3 className="h-2.5 w-2.5" />
                            Page {book.lastPage} / {book.pageCount}
                          </span>
                          <span>{progress}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(book.fileName) }}
                    className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/20 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                    title="Delete book"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">Delete &ldquo;{deleteConfirm.split('/').pop()}&rdquo;?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This will permanently delete the book and all associated bookmarks, word history, and annotations. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
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
