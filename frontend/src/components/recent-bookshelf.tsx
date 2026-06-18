'use client'

import { useEffect, useState, useRef } from 'react'
import { Loader2, Camera } from 'lucide-react'
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

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size))
  return rows
}

type RecentBookshelfProps = {
  onOpen: (fileName: string) => void
  loadingFileName?: string | null
}

export function RecentBookshelf({ onOpen, loadingFileName }: RecentBookshelfProps) {
  const [books, setBooks] = useState<RecentBook[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingCover, setUploadingCover] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const coverTargetRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await authFetch('/api/library')
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

  const handleCoverClick = (fileName: string) => {
    coverTargetRef.current = fileName
    coverInputRef.current?.click()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--ink)' }} />
      </div>
    )
  }

  if (books.length === 0) return null

  const rows = chunk(books, 4)

  return (
    <div className="space-y-4">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="relative">
          <div
            className="grid items-end gap-4 sm:gap-x-6"
            style={{ gridTemplateColumns: `repeat(4, 1fr)` }}
          >
            {row.map((book) => {
              const title = titleOf(book.fileName)
              const progress = book.pageCount > 0 ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100)) : 0
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
                      <>
                        <img
                          src={book.coverImage}
                          alt={`Cover of ${title}`}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
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

                    <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-white/10" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-black/20" />

                    {progress > 0 && (
                      <div className="pointer-events-none absolute -right-[3px] top-[3px] z-10">
                        <div style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
                          <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
                            <rect x="0" y="0" width="14" height="18" rx="1" fill="#c0392b" />
                            <path d="M7 18 L0 21 L0 18 Z" fill="#e74c3c" />
                            <path d="M7 18 L14 21 L14 18 Z" fill="#e74c3c" />
                            <path d="M0 18 L7 21 L14 18" fill="none" stroke="#a93226" strokeWidth="0.5" />
                          </svg>
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 h-1 w-full bg-black/30">
                      <div className="h-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>

                    {loadingFileName === book.fileName && (
                      <div
                        className="absolute inset-0 z-30 flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(28,25,23,0.85)' }}
                      >
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}

                    <div
                      className="absolute inset-0 flex flex-col p-2 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ backgroundColor: 'rgba(28,25,23,0.92)' }}
                    >
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
                        <div
                          className="mb-0.5 text-[10px] leading-tight text-white line-clamp-2"
                          style={{ fontFamily: 'var(--font-geist-serif)' }}
                        >
                          {title}
                        </div>
                        <div className="text-[7px] text-white/50 leading-tight" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                          {book.lastPage > 0 ? `P.${book.lastPage}/${book.pageCount} \u00B7 ` : ''}{book.pageCount}p \u00B7 {progress}%
                        </div>
                      </div>
                      <button
                        onClick={() => onOpen(book.fileName)}
                        className="px-2.5 py-0.5 text-[8px] uppercase tracking-widest transition-all hover:opacity-80"
                        style={{ backgroundColor: 'white', color: '#1c1917', fontFamily: 'var(--font-geist-mono)' }}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Wooden shelf board */}
          <div className="relative -mt-2">
            <div
              className="h-[6px] w-full"
              style={{
                background: `linear-gradient(180deg, var(--wood-top) 0%, var(--wood-body-2) 40%, var(--wood-body-3) 100%)`,
                boxShadow: 'inset 0 1px 0 var(--wood-highlight)',
              }}
            />
            <div
              className="relative h-[20px] w-full"
              style={{
                background: 'var(--wood-grain), var(--wood-board-bg)',
                backgroundBlendMode: 'multiply',
                boxShadow:
                  'inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -2px 6px var(--wood-shadow), 0 8px 14px -6px rgba(0,0,0,0.45)',
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
              className="h-[8px] w-full opacity-50"
              style={{ background: 'linear-gradient(180deg, var(--wood-shadow) 0%, rgba(0,0,0,0) 100%)' }}
            />
          </div>
        </div>
      ))}

      {/* Hidden file input for cover upload */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleCoverFile}
        className="hidden"
      />
    </div>
  )
}
