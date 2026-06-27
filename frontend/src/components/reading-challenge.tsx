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
  const t = `transition-all ${animated ? 'duration-700 ease-in-out' : 'duration-0'}`

  // Trunk grows upward from base (y=114) as ratio increases
  const trunkH   = 30 + ratio * 60          // 30 → 90
  const trunkY   = 114 - trunkH             // top of trunk
  const trunkW   = 8 + ratio * 6            // 8 → 14 (thickens slightly)
  const trunkX   = 50 - trunkW / 2

  // Canopy centre sits just above trunk top
  const canopyY = trunkY + 4

  // Each foliage layer scales with ratio
  const s1 = Math.max(0, Math.min(1, (ratio - 0.0) / 0.25))  // outer low  0–25%
  const s2 = Math.max(0, Math.min(1, (ratio - 0.2) / 0.25))  // mid low    20–45%
  const s3 = Math.max(0, Math.min(1, (ratio - 0.4) / 0.25))  // centre     40–65%
  const s4 = Math.max(0, Math.min(1, (ratio - 0.55) / 0.25)) // upper      55–80%
  const s5 = Math.max(0, Math.min(1, (ratio - 0.7) / 0.20))  // top crown  70–90%

  // Side branches appear progressively
  const b1 = Math.max(0, Math.min(1, (ratio - 0.15) / 0.2))
  const b2 = Math.max(0, Math.min(1, (ratio - 0.3) / 0.2))
  const b3 = Math.max(0, Math.min(1, (ratio - 0.5) / 0.2))
  const b4 = Math.max(0, Math.min(1, (ratio - 0.65) / 0.2))

  const fruitOpacity = Math.max(0, (ratio - 0.82) / 0.18)
  const starOpacity  = Math.max(0, (ratio - 0.95) / 0.05)

  return (
    <svg
      viewBox="0 -18 100 138"
      className="h-full w-full"
      aria-label={`Tree ${Math.round(ratio * 100)}% grown`}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))' }}
    >
      {/* Ground shadow */}
      <ellipse cx="50" cy="114" rx="36" ry="4" fill="#B4B2A9" opacity={0.4} />

      {/* === Side branches (behind canopy) === */}
      {b1 > 0 && (
        <path
          d={`M${50 - trunkW * 0.3} ${trunkY + trunkH * 0.35}
              Q${50 - 14 * b1} ${trunkY + trunkH * 0.3}
               ${50 - 18 * b1} ${trunkY + trunkH * 0.2}`}
          stroke="#6b5c52" strokeWidth="1.8" fill="none" strokeLinecap="round"
          opacity={b1} className={t}
        />
      )}
      {b2 > 0 && (
        <path
          d={`M${50 + trunkW * 0.3} ${trunkY + trunkH * 0.28}
              Q${50 + 14 * b2} ${trunkY + trunkH * 0.22}
               ${50 + 18 * b2} ${trunkY + trunkH * 0.1}`}
          stroke="#6b5c52" strokeWidth="1.8" fill="none" strokeLinecap="round"
          opacity={b2} className={t}
        />
      )}
      {b3 > 0 && (
        <path
          d={`M${50 - trunkW * 0.2} ${trunkY + trunkH * 0.15}
              Q${50 - 12 * b3} ${trunkY + trunkH * 0.08}
               ${50 - 16 * b3} ${trunkY - 2}`}
          stroke="#6b5c52" strokeWidth="1.4" fill="none" strokeLinecap="round"
          opacity={b3} className={t}
        />
      )}
      {b4 > 0 && (
        <path
          d={`M${50 + trunkW * 0.2} ${trunkY + trunkH * 0.1}
              Q${50 + 10 * b4} ${trunkY + trunkH * 0.02}
               ${50 + 14 * b4} ${trunkY - 5}`}
          stroke="#6b5c52" strokeWidth="1.4" fill="none" strokeLinecap="round"
          opacity={b4} className={t}
        />
      )}

      {/* === Trunk === */}
      <rect
        x={trunkX} y={trunkY}
        width={trunkW} height={trunkH}
        rx={trunkW / 2}
        fill="#6b5c52"
        className={t}
      />

      {/* === Foliage layers (back → front) === */}

      {/* Layer 1 — wide outer low (darkest) */}
      {s1 > 0 && (
        <>
          <ellipse cx={50 - 16 * s1} cy={canopyY + 8} rx={16 * s1} ry={20 * s1}
            fill="#27500A" opacity={0.85 * s1} className={t} />
          <ellipse cx={50 + 16 * s1} cy={canopyY + 8} rx={16 * s1} ry={20 * s1}
            fill="#27500A" opacity={0.85 * s1} className={t} />
        </>
      )}

      {/* Layer 2 — mid spread */}
      {s2 > 0 && (
        <>
          <ellipse cx={50 - 12 * s2} cy={canopyY + 2} rx={18 * s2} ry={24 * s2}
            fill="#3B6D11" opacity={0.9 * s2} className={t} />
          <ellipse cx={50 + 12 * s2} cy={canopyY + 2} rx={18 * s2} ry={24 * s2}
            fill="#3B6D11" opacity={0.9 * s2} className={t} />
        </>
      )}

      {/* Layer 3 — main centre canopy */}
      {s3 > 0 && (
        <ellipse cx={50} cy={canopyY - 4} rx={22 * s3} ry={28 * s3}
          fill="#639922" opacity={s3} className={t} />
      )}

      {/* Layer 4 — upper canopy (lighter) */}
      {s4 > 0 && (
        <>
          <ellipse cx={50 - 8 * s4} cy={canopyY - 12 * s4} rx={14 * s4} ry={18 * s4}
            fill="#63B022" opacity={0.9 * s4} className={t} />
          <ellipse cx={50 + 8 * s4} cy={canopyY - 10 * s4} rx={12 * s4} ry={16 * s4}
            fill="#63B022" opacity={0.85 * s4} className={t} />
        </>
      )}

      {/* Layer 5 — crown top */}
      {s5 > 0 && (
        <ellipse cx={50} cy={canopyY - 22 * s5} rx={14 * s5} ry={18 * s5}
          fill="#97C459" opacity={0.95 * s5} className={t} />
      )}

      {/* === Fruits (appear near completion) === */}
      {fruitOpacity > 0 && (
        <>
          <circle cx={38} cy={canopyY - 8} r={3} fill="#D85A30" opacity={fruitOpacity} />
          <circle cx={58} cy={canopyY - 2} r={3} fill="#D85A30" opacity={fruitOpacity * 0.9} />
          <circle cx={44} cy={canopyY - 18} r={2.5} fill="#D85A30" opacity={fruitOpacity * 0.8} />
          <circle cx={34} cy={canopyY + 4} r={2.5} fill="#FAC775" opacity={fruitOpacity * 0.85} />
          <circle cx={62} cy={canopyY - 14} r={2.5} fill="#FAC775" opacity={fruitOpacity * 0.75} />
        </>
      )}

      {/* === Sparkle (100%) === */}
      {starOpacity > 0 && (
        <text
          x="50" y={canopyY - 34}
          textAnchor="middle"
          fontSize="10"
          fill="#FAC775"
          opacity={starOpacity}
        >
          ✨
        </text>
      )}
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

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-warm)' }} />
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/10 bg-background/40 shadow-xl shadow-emerald-500/5 backdrop-blur-md transition-all hover:border-emerald-500/20 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Monthly Reading Challenge
          </h3>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setSelecting(true)}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[0.97]"
        >
          <BookPlus className="h-3.5 w-3.5 text-emerald-500" />
          {selectedBooks.length > 0 ? 'Edit' : 'Select Books'}
        </button>
      </div>

      {/* Selected books list */}
      {selectedBooks.length > 0 && (
        <div className="border-b border-border/40 px-5 py-3.5 space-y-2">
          {selectedBooks.map((book) => {
            const pct = book.pageCount > 0 ? Math.round((book.lastPage / book.pageCount) * 100) : 0
            const done = book.pageCount > 0 && book.lastPage >= book.pageCount
            return (
              <div key={book.fileName} className="flex items-center gap-3">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white shadow-sm"
                  style={{ backgroundColor: done ? '#10b981' : 'var(--accent-warm)' }}
                >
                  {done ? <Check className="h-3 w-3" /> : pct}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {titleOf(book.fileName)}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: done ? '#10b981' : 'var(--accent-warm)',
                      }}
                    />
                  </div>
                </div>
                <span className="text-[9px] font-bold tabular-nums text-muted-foreground/80">
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
          <p className="text-xs italic text-muted-foreground/75">
            Select the books you plan to finish this month
          </p>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col items-center gap-4 px-5 py-5 sm:flex-row sm:gap-6">
        <div className="h-28 w-20 shrink-0">
          <TreeSVG ratio={avgProgress} animated />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {finishedCount}
            </span>
            <span className="text-xs text-muted-foreground/60">/ {goal}</span>
            <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
              books completed
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${avgProgress * 100}%`, background: 'linear-gradient(90deg, #8b5cf6, #10b981)' }}
            />
          </div>
          <p className="mt-2 text-[10px] italic text-muted-foreground/85">
            {avgProgress >= 1
              ? 'Challenge complete! 🌱'
              : goal > 0 ? `${daysLeftInMonth()} days left this month` : ''
            }
          </p>
        </div>
      </div>

      {/* Book selector modal */}
      {selecting && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelecting(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
              <p className="text-sm font-bold text-foreground">
                Select Books for Challenge
              </p>
              <button onClick={() => setSelecting(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto px-3 py-2 space-y-0.5">
              {allBooks.length === 0 ? (
                <p className="py-6 text-center text-xs italic text-muted-foreground/70">No books in your library yet</p>
              ) : (
                allBooks.map((book) => {
                  const selected = selectedFiles.includes(book.fileName)
                  const pct = book.pageCount > 0 ? Math.round((book.lastPage / book.pageCount) * 100) : 0
                  const done = book.pageCount > 0 && book.lastPage >= book.pageCount
                  return (
                    <button
                      key={book.fileName}
                      onClick={() => toggleBook(book.fileName)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                        selected ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'hover:bg-muted/50 text-foreground/80'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border/60 bg-background'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="flex-1 truncate font-medium">{titleOf(book.fileName)}</span>
                      <span className="text-[10px] font-semibold tabular-nums" style={{ color: done ? '#10b981' : 'var(--accent-warm)' }}>
                        {done ? 'Done' : `${pct}%`}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
            <div className="border-t border-border/40 px-5 py-4 text-center bg-muted/20">
              <button
                onClick={() => setSelecting(false)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition-all active:scale-[0.97]"
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
