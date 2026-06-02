'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  BookOpen,
  Clock,
  TrendingUp,
  Loader2,
  BookText,
  Gauge,
  CalendarDays,
  BarChart3,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'

interface AnalyticsData {
  totalPages: number
  totalMinutes: number
  totalSessions: number
  avgPagesPerDay: number
  avgMinutesPerDay: number
  readingSpeed: number
  daysActive: number
  bookBreakdown: { pdfFileName: string; pages: number; minutes: number }[]
  dailyActivity: { date: string; pages: number; minutes: number }[]
}

export function ReadingAnalytics() {
  const { showReadingAnalytics, setShowReadingAnalytics, setShowReadingStats } = usePDFStore()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/reading-stats?days=90&mode=analytics')
      if (res.ok) {
        const json = await res.json()
        setData(json.analytics)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showReadingAnalytics) loadAnalytics()
  }, [showReadingAnalytics, loadAnalytics])

  const handleBack = useCallback(() => {
    setShowReadingAnalytics(false)
    setShowReadingStats(true)
  }, [setShowReadingAnalytics, setShowReadingStats])

  if (!showReadingAnalytics) return null

  const maxPageDay = data?.dailyActivity?.length
    ? Math.max(...data.dailyActivity.map((d) => d.pages), 1)
    : 1

  // Heatmap: last 12 weeks of days
  const heatmapDays = 84
  const heatmapData: { date: string; pages: number }[] = []
  if (data) {
    const today = new Date()
    for (let i = heatmapDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const activity = data.dailyActivity.find((a) => a.date === ds)
      heatmapData.push({ date: ds, pages: activity?.pages || 0 })
    }
  }
  const maxHeatmap = Math.max(...heatmapData.map((h) => h.pages), 1)

  const heatmapColor = (pages: number) => {
    if (pages === 0) return 'bg-muted/30'
    const intensity = Math.min(pages / maxHeatmap, 1)
    if (intensity < 0.25) return 'bg-emerald-200 dark:bg-emerald-900/40'
    if (intensity < 0.5) return 'bg-emerald-400 dark:bg-emerald-700'
    if (intensity < 0.75) return 'bg-emerald-500 dark:bg-emerald-600'
    return 'bg-emerald-600 dark:bg-emerald-500'
  }

  const monthLabels: { index: number; label: string }[] = []
  if (heatmapData.length > 0) {
    let lastMonth = ''
    heatmapData.forEach((h, i) => {
      const month = h.date.slice(0, 7)
      if (month !== lastMonth) {
        monthLabels.push({ index: i, label: new Date(h.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' }) })
        lastMonth = month
      }
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320 }}
        animate={{ x: 0 }}
        exit={{ x: 320 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <BarChart3 className="h-4 w-4 text-sky-500" />
            <h2 className="text-sm font-semibold text-foreground">Analytics</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setShowReadingAnalytics(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            </div>
          ) : !data ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div>
                <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">No reading data yet</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Start reading to see analytics</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {/* Aggregate Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={<BookOpen className="h-3.5 w-3.5" />} label="Total Pages" value={data.totalPages.toLocaleString()} color="text-sky-600 dark:text-sky-400" />
                <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Total Time" value={`${data.totalMinutes}m`} color="text-emerald-600 dark:text-emerald-400" />
                <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Avg / Day" value={`${data.avgPagesPerDay} pg`} color="text-violet-600 dark:text-violet-400" />
                <StatCard icon={<Gauge className="h-3.5 w-3.5" />} label="Speed" value={`${data.readingSpeed} pg/h`} color="text-amber-600 dark:text-amber-400" />
              </div>

              {/* 30-Day Bar Chart */}
              {data.dailyActivity.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Daily Activity (Last 30 days)
                    </span>
                  </div>
                  <div className="flex items-end gap-[3px] h-20">
                    {data.dailyActivity.slice(-30).map((d, i) => {
                      const height = d.pages > 0 ? Math.max(4, (d.pages / maxPageDay) * 100) : 2
                      return (
                        <div
                          key={d.date}
                          className="flex-1 flex flex-col items-center justify-end group relative"
                        >
                          <div
                            className={`w-full rounded-sm transition-all ${
                              d.pages > 0 ? 'bg-sky-400 dark:bg-sky-500' : 'bg-muted/30'
                            }`}
                            style={{ height: `${height}%`, minHeight: d.pages > 0 ? '4px' : '2px' }}
                          />
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                            <div className="whitespace-nowrap rounded bg-popover px-2 py-1 text-[9px] text-popover-foreground shadow-md">
                              {d.date.slice(5)}: {d.pages}p {d.minutes}m
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1 text-[8px] text-muted-foreground/50">
                    <span>{data.dailyActivity.slice(-30)[0]?.date.slice(5)}</span>
                    <span>{data.dailyActivity.slice(-30)[data.dailyActivity.slice(-30).length - 1]?.date.slice(5)}</span>
                  </div>
                </div>
              )}

              {/* Calendar Heatmap (12 weeks) */}
              {heatmapData.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      12-Week Heatmap
                    </span>
                  </div>

                  {/* Month labels */}
                  <div className="flex mb-1" style={{ paddingLeft: '0px' }}>
                    {monthLabels.map((m, i) => (
                      <div
                        key={m.index}
                        className="text-[7px] text-muted-foreground/50"
                        style={{ marginLeft: i === 0 ? `${(m.index / heatmapData.length) * 100}%` : undefined, position: 'relative', left: i > 0 ? `${(m.index / heatmapData.length) * 100}%` : undefined }}
                      >
                        {monthLabels.length <= 4 || i === 0 || i === monthLabels.length - 1 || monthLabels.length - i <= 2 ? m.label : ''}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-[2px]">
                    {heatmapData.map((h) => (
                      <div
                        key={h.date}
                        className={`aspect-square rounded-sm ${heatmapColor(h.pages)} group relative cursor-default`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                          <div className="whitespace-nowrap rounded bg-popover px-2 py-1 text-[9px] text-popover-foreground shadow-md">
                            {h.date}: {h.pages} pages
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <span className="text-[8px] text-muted-foreground/50">Less</span>
                    <div className="h-2.5 w-2.5 rounded-sm bg-muted/30" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900/40" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
                    <span className="text-[8px] text-muted-foreground/50">More</span>
                  </div>
                </div>
              )}

              {/* Book Breakdown */}
              {data.bookBreakdown.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BookText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Per Book
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {data.bookBreakdown.map((book) => (
                      <div
                        key={book.pdfFileName}
                        className="rounded-lg bg-muted/20 px-3 py-2"
                      >
                        <p className="text-xs font-medium text-foreground truncate" title={book.pdfFileName}>
                          {book.pdfFileName}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{book.pages} pages</span>
                          <span className="text-[10px] text-muted-foreground">{book.minutes}m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">
                  {data.daysActive} active days out of 90 &middot; {data.totalSessions} reading sessions
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
