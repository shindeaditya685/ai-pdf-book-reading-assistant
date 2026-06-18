'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Camera } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

interface BookInfo {
  fileName: string
  pageCount: number
  lastPage: number
  wordCount: number
  bookmarkCount: number
  quoteCount: number
  totalPagesRead: number
  totalMinutes: number
  coverImage: string | null
  createdAt: string
  updatedAt: string
}

const SPINE_COLORS = [
  '#2D423F',
  '#5C2D2D',
  '#2D3142',
  '#3F3A2D',
  '#4A2D3F',
  '#2D3F3F',
  '#3F2D2D',
  '#1F2D2D',
]

const SPINE_ACCENTS = [
  '#4A6B5C',
  '#8A4A4A',
  '#4A5080',
  '#6B6340',
  '#7A4A6B',
  '#4A6B6B',
  '#7A4A4A',
  '#3A4A4A',
]

function hashColorIndex(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % SPINE_COLORS.length
}

function titleOf(fileName: string) {
  return (fileName.split('/').pop() || fileName).replace(/\.pdf$/i, '')
}

function useColumnCount() {
  const [cols, setCols] = useState(4)
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w >= 1280) setCols(5)
      else if (w >= 1024) setCols(4)
      else if (w >= 768) setCols(3)
      else setCols(2)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])
  return cols
}

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size))
  return rows
}

export default function LibraryPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<BookInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState<string | null>(null)
  const [addBookLoading, setAddBookLoading] = useState(false)
  const [bookOpening, setBookOpening] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const coverTargetRef = useRef<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const cols = useColumnCount()

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
    setBookOpening(fileName)
    setTimeout(() => router.push(`/dashboard?open=${encodeURIComponent(fileName)}`), 100)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return books
    return books.filter((b) => b.fileName.toLowerCase().includes(q))
  }, [books, search])

  const totals = useMemo(() => {
    const pagesRead = books.reduce((s, b) => s + b.totalPagesRead, 0)
    const words = books.reduce((s, b) => s + b.wordCount, 0)
    const hours = books.reduce((s, b) => s + b.totalMinutes, 0) / 60
    return { count: books.length, pagesRead, words, hours }
  }, [books])

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return
    handleDelete(deleteConfirm)
  }

  const handleCoverClick = (fileName: string) => {
    coverTargetRef.current = fileName
    coverInputRef.current?.click()
  }

  const handleAddBookClick = () => {
    pdfInputRef.current?.click()
  }

  const handleAddBookFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAddBookLoading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      await authFetch('/api/db/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, content: dataUrl, pageCount: 0, lastPage: 0 }),
      })

      await loadBooks()
    } catch { /* ignore */ }
    setAddBookLoading(false)
    if (e.target) e.target.value = ''
  }

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const target = coverTargetRef.current
    if (!file || !target) return

    setUploadingCover(target)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await authFetch('/api/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: target, coverImage: dataUrl }),
      })

      if (res.ok) {
        setBooks((prev) => prev.map((b) =>
          b.fileName === target ? { ...b, coverImage: dataUrl } : b
        ))
      }
    } catch { /* ignore */ }
    setUploadingCover(null)
    coverTargetRef.current = null
    if (e.target) e.target.value = ''
  }

  const pendingTitle = deleteConfirm ? titleOf(deleteConfirm) : ''

  type Tile = { kind: 'book'; book: BookInfo } | { kind: 'add' }
  const tiles: Tile[] = [
    ...filtered.map((b): Tile => ({ kind: 'book', book: b })),
    { kind: 'add' } as Tile,
  ]
  const rows = chunk(tiles, cols)

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--canvas)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--ink)' }} />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen p-8 md:p-12 lg:p-16"
      style={{ backgroundColor: 'var(--canvas)', color: 'var(--ink)', fontFamily: 'var(--font-geist-sans)' }}
    >
      {/* Masthead */}
      <header className="mx-auto mb-16 flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="flex items-start gap-4 min-w-0">
          <Link
            href="/dashboard"
            className="mt-1 flex size-9 shrink-0 items-center justify-center border transition-all hover:bg-black/5"
            style={{ borderColor: 'var(--paper-border)', color: 'var(--accent-warm)' }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="mb-2 text-5xl italic tracking-tight md:text-6xl" style={{ fontFamily: 'var(--font-geist-serif)' }}>
              Libris
            </h1>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--accent-warm)' }}
            >
              Personal Collection / {books.length.toString().padStart(3, '0')} Volumes
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a title..."
            className="w-full border-b bg-transparent px-1 py-2 placeholder:italic focus:outline-none"
            style={{
              borderColor: 'rgba(28,25,23,0.2)',
              color: 'var(--ink)',
              fontFamily: 'var(--font-geist-sans)',
            }}
          />
          <div
            className="pointer-events-none absolute right-2 top-3 text-[10px] opacity-40"
            style={{ fontFamily: 'var(--font-geist-mono)' }}
          >
            [CMD+K]
          </div>
        </div>
      </header>

      {/* Stats strip */}
      <div
        className="mx-auto mb-16 grid max-w-7xl grid-cols-2 gap-px border md:grid-cols-4"
        style={{ backgroundColor: 'var(--paper-border)', borderColor: 'var(--paper-border)' }}
      >
        {[
          { label: 'Total Books', value: totals.count.toLocaleString() },
          { label: 'Pages Read', value: totals.pagesRead.toLocaleString() },
          { label: 'Words Lookup', value: totals.words.toLocaleString() },
          { label: 'Reading Hours', value: totals.hours.toFixed(1) },
        ].map((s) => (
          <div key={s.label} className="p-6" style={{ backgroundColor: 'var(--canvas)' }}>
            <span
              className="mb-1 block text-[10px] uppercase tracking-tighter"
              style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--accent-warm)' }}
            >
              {s.label}
            </span>
            <span className="text-3xl italic" style={{ fontFamily: 'var(--font-geist-serif)' }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Wooden bookshelf */}
      {loading ? (
        <div className="mx-auto flex max-w-7xl items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink)' }} />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-10">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="relative">
              {/* Row of books sitting on the shelf */}
              <div
                className="relative z-10 grid items-end gap-x-6 px-3 sm:px-6"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {row.map((tile, i) => {
                  if (tile.kind === 'add') {
                    return (
                      <button
                        key={`add-${rowIdx}-${i}`}
                        type="button"
                        onClick={handleAddBookClick}
                        disabled={addBookLoading}
                        className="group/add flex aspect-[3/4] cursor-pointer flex-col items-center justify-center border border-dashed transition-all disabled:cursor-default disabled:opacity-50"
                        style={{
                          backgroundColor: 'rgba(251,249,246,0.4)',
                          borderColor: 'var(--paper-border)',
                          color: 'var(--ink)',
                        }}
                      >
                        <div
                          className="mb-3 flex size-8 items-center justify-center rounded-full border text-lg group-hover/add:border-ink"
                          style={{
                            borderColor: 'rgba(28,25,23,0.4)',
                            fontFamily: 'var(--font-geist-mono)',
                          }}
                        >
                          {addBookLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '+'}
                        </div>
                        <span
                          className="text-[10px] uppercase tracking-widest opacity-40 group-hover/add:opacity-100"
                          style={{ fontFamily: 'var(--font-geist-mono)' }}
                        >
                          {addBookLoading ? 'Uploading\u2026' : 'Add Book'}
                        </span>
                      </button>
                    )
                  }
                  const book = tile.book
                  const title = titleOf(book.fileName)
                  const progress = book.pageCount > 0 ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100)) : 0
                  const minutesLabel =
                    book.totalMinutes >= 60
                      ? `${Math.floor(book.totalMinutes / 60)}h ${book.totalMinutes % 60}m`
                      : `${book.totalMinutes}m`
                  const statusLabel =
                    progress === 0 ? 'Not Started' : progress === 100 ? 'Finished' : `${progress}% Complete`
                  const colorIdx = hashColorIndex(book.fileName)
                  const spineColor = SPINE_COLORS[colorIdx]
                  const accentColor = SPINE_ACCENTS[colorIdx]

                  return (
                    <div
                      key={book.fileName}
                      className="group relative cursor-pointer"
                      onClick={() => handleOpen(book.fileName)}
                    >
                      <div
                        className="relative aspect-[3/4] overflow-hidden border border-black/10 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]"
                        style={{ backgroundColor: spineColor }}
                      >
                        {/* Book cover image or gradient fallback */}
                        {book.coverImage ? (
                          <>
                            <img
                              src={book.coverImage}
                              alt={`Cover of ${title}`}
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            {/* Change cover button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCoverClick(book.fileName) }}
                              className="absolute right-1.5 top-1.5 z-20 flex size-6 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
                            >
                              <Camera className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <div
                              className="absolute inset-0"
                              style={{
                                background: `linear-gradient(135deg, ${spineColor} 0%, ${accentColor} 50%, ${spineColor} 100%)`,
                              }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                              <div
                                className="mb-2 text-sm font-bold leading-tight text-white/90 md:text-base"
                                style={{ fontFamily: 'var(--font-geist-serif)' }}
                              >
                                {title}
                              </div>
                              <div className="text-[10px] text-white/50" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                                {book.pageCount} pp.
                              </div>
                            </div>
                            {/* Add cover button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCoverClick(book.fileName) }}
                              className="absolute inset-0 z-20 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all hover:bg-black/30 group-hover:opacity-100"
                            >
                              <div className="flex flex-col items-center gap-1">
                                {uploadingCover === book.fileName ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <>
                                    <Camera className="h-5 w-5 drop-shadow-lg" />
                                    <span className="text-[9px] uppercase tracking-wider drop-shadow-lg">Add Cover</span>
                                  </>
                                )}
                              </div>
                            </button>
                          </>
                        )}

                        {/* Inner spine highlight */}
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-white/10" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-black/20" />

                        {/* Progress */}
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-black/30">
                          <div className="h-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>

                        {/* Loading overlay */}
                        {bookOpening === book.fileName && (
                          <div
                            className="absolute inset-0 z-30 flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(28,25,23,0.85)' }}
                          >
                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                          </div>
                        )}

                        {/* Hover overlay */}
                        <div
                          className="absolute inset-0 flex flex-col p-3 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          style={{ backgroundColor: 'rgba(28,25,23,0.92)' }}
                        >
                          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
                            <div
                              className="mb-1 text-xs leading-tight text-white line-clamp-2"
                              style={{ fontFamily: 'var(--font-geist-serif)' }}
                            >
                              {title}
                            </div>
                            <div className="mb-1 text-[8px] text-white/50 leading-tight" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                              {book.lastPage > 0 ? `P.${book.lastPage}/${book.pageCount} \u00B7 ` : ''}{progress}% \u00B7 {book.pageCount}p
                            </div>
                            {book.totalMinutes > 0 && (
                              <div className="mb-1 text-[9px] text-white/60">{minutesLabel} read</div>
                            )}
                            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[8px] text-white/50">
                              {book.wordCount > 0 && <span>{book.wordCount}w</span>}
                              {book.bookmarkCount > 0 && <span>{book.bookmarkCount}m</span>}
                              {book.quoteCount > 0 && <span>{book.quoteCount}q</span>}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpen(book.fileName) }}
                            className="mb-1.5 px-3 py-1 text-[9px] uppercase tracking-widest transition-all hover:opacity-80"
                            style={{ backgroundColor: 'white', color: '#1c1917', fontFamily: 'var(--font-geist-mono)' }}
                          >
                            Continue
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm(book.fileName)
                            }}
                            className="text-[8px] tracking-tighter text-red-400/70 transition-colors hover:text-red-300"
                            style={{ fontFamily: 'var(--font-geist-mono)' }}
                          >
                            [ DELETE ]
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Wooden shelf board */}
              <div className="relative">
                <div
                  className="h-[6px] w-full"
                  style={{
                    background: 'linear-gradient(180deg, #c89a6a 0%, #a37242 40%, #7a4f29 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                  }}
                />
                <div
                  className="relative h-[22px] w-full"
                  style={{
                    background:
                      'repeating-linear-gradient(90deg, #6b3f1f 0px, #7a4a26 2px, #5e3618 4px, #6b3f1f 7px, #7a4a26 10px), linear-gradient(180deg, #6b3f1f 0%, #4a2a12 100%)',
                    backgroundBlendMode: 'multiply',
                    boxShadow:
                      'inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.5), 0 8px 14px -6px rgba(0,0,0,0.45)',
                  }}
                >
                  <div
                    className="pointer-events-none absolute top-1/2 h-[8px] w-[20px] -translate-y-1/2 rounded-full opacity-40"
                    style={{
                      left: `${15 + (rowIdx * 23) % 60}%`,
                      background: 'radial-gradient(ellipse at center, #2a1808 0%, transparent 70%)',
                    }}
                  />
                </div>
                <div
                  className="h-[10px] w-full opacity-50"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)' }}
                />
              </div>
            </div>
          ))}

          {/* Empty / no-match state */}
          {filtered.length === 0 && (
            <div className="mx-auto mt-12 max-w-7xl text-center">
              <p className="italic" style={{ fontFamily: 'var(--font-geist-serif)', color: 'var(--accent-warm)' }}>
                {books.length === 0
                  ? 'Your library is empty. Upload a PDF to get started.'
                  : `No volumes match "${search}".`}
              </p>
            </div>
          )}

          {/* Bottom decorative bar */}
          {filtered.length > 0 && (
            <div
              className="relative h-1 rounded-sm"
              style={{
                background:
                  'linear-gradient(90deg, rgba(107,63,31,0.4) 0%, rgba(122,74,38,0.5) 50%, rgba(107,63,31,0.4) 100%)',
              }}
            />
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleCoverFile}
        className="hidden"
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleAddBookFile}
        className="hidden"
      />

      {/* Footer */}
      <footer
        className="mx-auto mt-24 flex max-w-7xl justify-between border-t pt-8"
        style={{ borderColor: 'var(--paper-border)' }}
      >
        <p className="text-[10px] opacity-30" style={{ fontFamily: 'var(--font-geist-mono)' }}>
          SYST_04_ARCHIVE
        </p>
        <p className="text-[10px] uppercase opacity-30" style={{ fontFamily: 'var(--font-geist-mono)' }}>
          Library Last Synced: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </p>
      </footer>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(28,25,23,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="relative w-full max-w-md border p-8 shadow-2xl"
            style={{ backgroundColor: 'var(--canvas)', borderColor: 'var(--paper-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-3xl italic" style={{ fontFamily: 'var(--font-geist-serif)' }}>
              Remove &ldquo;{pendingTitle}&rdquo;?
            </h3>
            <p className="mb-8 text-sm leading-relaxed" style={{ color: 'var(--accent-warm)' }}>
              This volume and all associated bookmarks, lookups, and annotations will be permanently
              purged from your archive. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-black/5"
                style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--accent-warm)' }}
              >
                [ CANCEL ]
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-[10px] uppercase tracking-widest text-white"
                style={{ fontFamily: 'var(--font-geist-mono)', backgroundColor: 'var(--ink)' }}
              >
                [ CONFIRM PURGE ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
