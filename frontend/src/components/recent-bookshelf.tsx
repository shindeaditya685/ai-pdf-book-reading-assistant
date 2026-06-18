'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { authFetch } from '@/lib/api'

interface RecentBook {
  fileName: string
  pageCount: number
  lastPage: number
  coverImage: string | null
}

const SPINE_COLORS = [
  '#2D423F', '#5C2D2D', '#2D3142', '#3F3A2D',
  '#4A2D3F', '#2D3F3F', '#3F2D2D', '#1F2D2D',
]

const SPINE_ACCENTS = [
  '#4A6B5C', '#8A4A4A', '#4A5080', '#6B6340',
  '#7A4A6B', '#4A6B6B', '#7A4A4A', '#3A4A4A',
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

type RecentBookshelfProps = {
  onOpen: (fileName: string) => void
}

export function RecentBookshelf({ onOpen }: RecentBookshelfProps) {
  const [books, setBooks] = useState<RecentBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await authFetch('/api/recent-books')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setBooks(data.books || [])
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--ink)' }} />
      </div>
    )
  }

  if (books.length === 0) return null

  const allTiles = [
    ...books,
    null, // More Books placeholder
  ]

  return (
    <div className="space-y-6">
      <div
        className="grid items-end gap-x-6 px-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(5, allTiles.length)}, minmax(0, 1fr))` }}
      >
        {allTiles.map((book, i) => {
          if (book === null) {
            return (
              <Link
                key="more-books"
                href="/library"
                className="group/more flex aspect-[3/4] cursor-pointer flex-col items-center justify-center border border-dashed transition-all hover:bg-black/5"
                style={{
                  backgroundColor: 'rgba(251,249,246,0.4)',
                  borderColor: 'var(--paper-border)',
                  color: 'var(--ink)',
                }}
              >
                <div
                  className="mb-2 text-lg transition-transform group-hover/more:translate-x-0.5"
                  style={{ fontFamily: 'var(--font-geist-mono)' }}
                >
                  &rarr;
                </div>
                <span
                  className="text-center text-[9px] uppercase tracking-widest opacity-40 group-hover/more:opacity-100"
                  style={{ fontFamily: 'var(--font-geist-mono)' }}
                >
                  More<br />Books
                </span>
              </Link>
            )
          }

          const title = titleOf(book.fileName)
          const progress = book.pageCount > 0 ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100)) : 0
          const minutesLabel = ''
          const statusLabel = progress === 0 ? 'Not Started' : progress === 100 ? 'Finished' : `${progress}% Complete`
          const colorIdx = hashColorIndex(book.fileName)
          const spineColor = SPINE_COLORS[colorIdx]
          const accentColor = SPINE_ACCENTS[colorIdx]

          return (
            <div
              key={book.fileName}
              className="group relative cursor-pointer"
              onClick={() => onOpen(book.fileName)}
            >
              <div
                className="relative aspect-[3/4] overflow-hidden border border-black/10 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]"
                style={{ backgroundColor: spineColor }}
              >
                {book.coverImage ? (
                  <img
                    src={book.coverImage}
                    alt={`Cover of ${title}`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${spineColor} 0%, ${accentColor} 50%, ${spineColor} 100%)`,
                      }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                      <div
                        className="mb-1 text-[11px] font-bold leading-tight text-white/90"
                        style={{ fontFamily: 'var(--font-geist-serif)' }}
                      >
                        {title}
                      </div>
                      <div className="text-[9px] text-white/50" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                        {book.pageCount} pp.
                      </div>
                    </div>
                  </>
                )}

                <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-white/10" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-black/20" />

                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/30">
                  <div className="h-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>

                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ backgroundColor: 'rgba(28,25,23,0.92)' }}
                >
                  <div
                    className="mb-1 text-sm text-white"
                    style={{ fontFamily: 'var(--font-geist-serif)' }}
                  >
                    {title}
                  </div>
                  <div className="mb-2 text-[9px] text-white/60" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                    STATS
                  </div>
                  <div className="mb-0.5 text-xs text-white">{book.pageCount} Pages</div>
                  <div className="text-xs text-white">{statusLabel}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
