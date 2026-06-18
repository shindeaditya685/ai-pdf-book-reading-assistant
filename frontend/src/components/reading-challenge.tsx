'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api'
import { Loader2, BookPlus, X, Check } from 'lucide-react'

const STORAGE_KEY = 'reading-challenge-books'

function getSelected(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveSelected(files: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(files)) } catch { /* ignore */ }
}

function daysLeftInMonth() {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return last.getDate() - now.getDate()
}

function titleOf(fileName: string) {
  return (fileName.split('/').pop() || fileName).replace(/\.pdf$/i, '')
}

interface BookInfo {
  fileName: string
  pageCount: number
  lastPage: number
}

function TreeSVG({ ratio, animated }: { ratio: number; animated: boolean }) {
  const trunkBase = 102, trunkTop = 48
  const canopyY = trunkTop - 4 - ratio * 10
  const leafCount = Math.floor(ratio * 28)
  const canopyRadius = 6 + ratio * 22

  return (
    <svg viewBox="0 0 100 120" className="h-full w-full" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))' }}>
      <ellipse cx="50" cy="114" rx="36" ry="4" fill="var(--paper-border)" opacity={0.5} />
      {Array.from({ length: leafCount }).map((_, i) => {
        const angle = (i / leafCount) * Math.PI * 2 + (ratio * 0.3)
        const dist = 2 + Math.random() * canopyRadius * (0.7 + ratio * 0.3)
        const lx = 50 + Math.cos(angle) * dist
        const ly = canopyY + Math.sin(angle) * dist * 0.65
        const size = 2.5 + Math.random() * 5 * ratio
        const shade = 0.35 + Math.random() * 0.4
        return (
          <ellipse key={i} cx={lx} cy={ly} rx={size * 0.65} ry={size}
            fill={`oklch(${0.5 + shade * 0.2} ${0.15 + ratio * 0.1} ${130 + Math.random() * 40})`}
            opacity={0.6 + ratio * 0.4}
            transform={`rotate(${-20 + Math.random() * 40}, ${lx}, ${ly})`}
            className={animated ? 'transition-all duration-1000' : ''}
          />
        )
      })}
      {ratio > 0.85 && Array.from({ length: 4 }).map((_, i) => {
        const fx = 38 + Math.random() * 24
        const fy = canopyY - 6 - Math.random() * canopyRadius * 0.6
        return <circle key={`f-${i}`} cx={fx} cy={fy} r={2 + Math.random() * 1.5} fill="#d97706" opacity={0.5 + Math.random() * 0.3} />
      })}
      <path d={`M46 ${trunkBase} Q42 ${trunkBase * 0.72} 44 ${trunkTop} L56 ${trunkTop} Q58 ${trunkBase * 0.72} 54 ${trunkBase} Z`} fill="#6b5c52" className={animated ? 'transition-all duration-1000' : ''} />
      {ratio > 0.15 && <path d={`M44 ${trunkTop + 6} Q${44 - ratio * 14} ${canopyY + 6} ${44 - canopyRadius * 0.6} ${canopyY + 4}`} stroke="#6b5c52" strokeWidth="2" fill="none" strokeLinecap="round" className={animated ? 'transition-all duration-700' : ''} />}
      {ratio > 0.3 && <path d={`M56 ${trunkTop + 3} Q${56 + ratio * 12} ${canopyY + 4} ${56 + canopyRadius * 0.5} ${canopyY}`} stroke="#6b5c52" strokeWidth="2" fill="none" strokeLinecap="round" className={animated ? 'transition-all duration-700' : ''} />}
      {ratio > 0.5 && <path d={`M46 ${trunkTop - 1} Q${40 - ratio * 4} ${canopyY - 4} ${50 - canopyRadius * 0.5} ${canopyY - 6}`} stroke="#6b5c52" strokeWidth="1.8" fill="none" strokeLinecap="round" className={animated ? 'transition-all duration-700' : ''} />}
      {ratio > 0.7 && <path d={`M54 ${trunkTop - 3} Q${60 + ratio * 3} ${canopyY - 6} ${50 + canopyRadius * 0.5} ${canopyY - 8}`} stroke="#6b5c52" strokeWidth="1.8" fill="none" strokeLinecap="round" className={animated ? 'transition-all duration-700' : ''} />}
    </svg>
  )
}

export function ReadingChallenge() {
  const [selecting, setSelecting] = useState(false)
  const [allBooks, setAllBooks] = useState<BookInfo[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>(getSelected)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch('/api/library')
        if (res.ok) {
          const data = await res.json()
          setAllBooks(data.books || [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  const selectedBooks = useMemo(() => {
    return selectedFiles.map((f) => allBooks.find((b) => b.fileName === f)).filter(Boolean) as BookInfo[]
  }, [selectedFiles, allBooks])

  const finishedCount = useMemo(() => {
    return selectedBooks.filter((b) => b.pageCount > 0 && b.lastPage >= b.pageCount).length
  }, [selectedBooks])

  const goal = selectedFiles.length
  const avgProgress = useMemo(() => {
    if (selectedBooks.length === 0) return 0
    const total = selectedBooks.reduce((sum, b) => sum + (b.pageCount > 0 ? b.lastPage / b.pageCount : 0), 0)
    return Math.min(1, total / selectedBooks.length)
  }, [selectedBooks])

  const toggleBook = (fileName: string) => {
    setSelectedFiles((prev) => {
      const next = prev.includes(fileName) ? prev.filter((f) => f !== fileName) : [...prev, fileName]
      saveSelected(next)
      return next
    })
  }

  const treeKey = `tree-${Math.round(avgProgress * 100)}`

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center" style={{ fontFamily: 'var(--font-geist-sans)' }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-warm)' }} />
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-sm border"
      style={{ borderColor: 'var(--paper-border)', backgroundColor: 'var(--canvas)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--paper-border)' }}>
        <div>
          <h3 className="text-sm italic tracking-tight" style={{ fontFamily: 'var(--font-geist-serif)', color: 'var(--ink)' }}>
            Monthly Reading Challenge
          </h3>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--accent-warm)' }}>
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setSelecting(true)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all hover:opacity-70"
          style={{ borderColor: 'var(--paper-border)', color: 'var(--ink)', fontFamily: 'var(--font-geist-mono)' }}
        >
          <BookPlus className="h-3 w-3" />
          {selectedBooks.length > 0 ? 'Edit' : 'Select Books'}
        </button>
      </div>

      {/* Selected books list */}
      {selectedBooks.length > 0 && (
        <div className="border-b px-5 py-3 space-y-2" style={{ borderColor: 'var(--paper-border)' }}>
          {selectedBooks.map((book) => {
            const pct = book.pageCount > 0 ? Math.round((book.lastPage / book.pageCount) * 100) : 0
            const done = book.pageCount > 0 && book.lastPage >= book.pageCount
            return (
              <div key={book.fileName} className="flex items-center gap-3">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: done ? '#059669' : 'var(--accent-warm)' }}
                >
                  {done ? <Check className="h-3 w-3" /> : pct}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs" style={{ fontFamily: 'var(--font-geist-sans)', color: 'var(--ink)' }}>
                    {titleOf(book.fileName)}
                  </p>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--paper-border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: done ? '#059669' : 'var(--accent-warm)',
                      }}
                    />
                  </div>
                </div>
                <span className="text-[9px] tabular-nums" style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--accent-warm)' }}>
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* No books selected */}
      {selectedBooks.length === 0 && (
        <div className="px-5 py-6 text-center">
          <p className="text-xs italic" style={{ color: 'var(--accent-warm)' }}>
            Select the books you plan to finish this month
          </p>
        </div>
      )}

      {/* Body */}
      <div className="flex items-center gap-6 px-5 py-4">
        <div className="h-24 w-20 shrink-0">
          <TreeSVG key={treeKey} ratio={avgProgress} animated />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl italic" style={{ fontFamily: 'var(--font-geist-serif)', color: 'var(--ink)' }}>
              {finishedCount}
            </span>
            <span className="text-sm" style={{ color: 'var(--accent-warm)' }}>/ {goal}</span>
            <span className="ml-1 text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--accent-warm)' }}>
              books
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--paper-border)' }}>
            <div className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${avgProgress * 100}%`, background: 'linear-gradient(90deg, #6b5c52, #059669)' }}
            />
          </div>
          <p className="mt-1.5 text-[10px] italic" style={{ color: 'var(--accent-warm)' }}>
            {avgProgress >= 1
              ? 'Challenge complete! \uD83C\uDF31'
              : goal > 0 ? `${daysLeftInMonth()} days left this month` : ''
            }
          </p>
        </div>
      </div>

      {/* Book selector modal */}
      {selecting && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16"
          style={{ backgroundColor: 'rgba(28,25,23,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelecting(false)}
        >
          <div
            className="w-full max-w-md rounded-sm border shadow-xl"
            style={{ backgroundColor: 'var(--canvas)', borderColor: 'var(--paper-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--paper-border)' }}>
              <p className="text-sm italic" style={{ fontFamily: 'var(--font-geist-serif)', color: 'var(--ink)' }}>
                Select Books for Challenge
              </p>
              <button onClick={() => setSelecting(false)} className="rounded p-1 hover:opacity-60" style={{ color: 'var(--accent-warm)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto px-3 py-2">
              {allBooks.length === 0 ? (
                <p className="py-6 text-center text-xs italic" style={{ color: 'var(--accent-warm)' }}>No books in your library yet</p>
              ) : (
                allBooks.map((book) => {
                  const selected = selectedFiles.includes(book.fileName)
                  const pct = book.pageCount > 0 ? Math.round((book.lastPage / book.pageCount) * 100) : 0
                  const done = book.pageCount > 0 && book.lastPage >= book.pageCount
                  return (
                    <button
                      key={book.fileName}
                      onClick={() => toggleBook(book.fileName)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                        selected ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border/60'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="flex-1 truncate" style={{ color: 'var(--ink)' }}>{titleOf(book.fileName)}</span>
                      <span className="text-[9px] tabular-nums" style={{ color: done ? '#059669' : 'var(--accent-warm)' }}>
                        {done ? 'Done' : `${pct}%`}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
            <div className="border-t px-5 py-3 text-center" style={{ borderColor: 'var(--paper-border)' }}>
              <button
                onClick={() => setSelecting(false)}
                className="rounded px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-all hover:opacity-80"
                style={{ backgroundColor: 'var(--ink)' }}
              >
                Done ({selectedFiles.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
