'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, User, LogOut, ArrowLeft, BarChart3, Bookmark, Brain, Clock, Flame, Target, Library, Zap, TrendingUp, BookMarked, Volume2, FileText, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import Link from 'next/link'

interface ReadingAnalytics {
  totalPages: number
  totalMinutes: number
  totalSessions: number
  avgPagesPerDay: number
  avgMinutesPerDay: number
  readingSpeed: number
  topBooks: { fileName: string; pages: number; minutes: number }[]
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const {
    wordHistory,
    bookmarks,
    flashcards,
    streakCount,
    todayPages,
    todayMinutes,
    dailyGoalPages,
    dailyGoalMinutes,
    dailyGoalEnabled,
    setTodayStats,
    setStreakCount,
    setDailyGoal,
  } = usePDFStore()

  const [analytics, setAnalytics] = useState<ReadingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<{ date: string; pagesRead: number; timeSpentMs: number }[]>([])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsRes, goalRes] = await Promise.all([
          authFetch('/api/reading-stats?days=90'),
          authFetch('/api/reading-goal'),
        ])
        if (statsRes.ok) {
          const data = await statsRes.json()
          setAnalytics(data.analytics)
          setHistory(data.history || [])
          if (data.today) {
            setTodayStats(data.today.pagesRead || 0, Math.round((data.today.timeSpentMs || 0) / 60000))
          }
          if (data.streak != null) setStreakCount(data.streak)
        }
        if (goalRes.ok) {
          const goal = await goalRes.json()
          setDailyGoal(goal.enabled || false, goal.pages || 10, goal.minutes || 30)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    loadStats()
  }, [setTodayStats, setStreakCount, setDailyGoal])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const formatMinutes = (m: number) => {
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    const remain = m % 60
    return remain > 0 ? `${h}h ${remain}m` : `${h}h`
  }

  const pageProgress = dailyGoalPages > 0 ? Math.min(100, Math.round((todayPages / dailyGoalPages) * 100)) : 0
  const minuteProgress = dailyGoalMinutes > 0 ? Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100)) : 0

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 shadow-sm">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Profile</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-red-500 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {loading ? (
          <div className="space-y-6">
            {/* User Info skeleton */}
            <div className="rounded-xl border bg-background/60 p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
            {/* Goals skeleton */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl border bg-background/60 p-4 shadow-sm animate-pulse">
                  <div className="h-3 w-24 rounded bg-muted mb-3" />
                  <div className="h-2 w-full rounded-full bg-muted" />
                </div>
              ))}
            </div>
            {/* Stats grid skeleton */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border bg-background/60 p-4 text-center shadow-sm animate-pulse">
                  <div className="mx-auto h-4 w-4 rounded bg-muted" />
                  <div className="mx-auto mt-3 h-6 w-12 rounded bg-muted" />
                  <div className="mx-auto mt-1 h-3 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
            {/* Secondary stats skeleton */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border bg-background/60 p-4 text-center shadow-sm animate-pulse">
                  <div className="mx-auto h-4 w-4 rounded bg-muted" />
                  <div className="mx-auto mt-3 h-6 w-12 rounded bg-muted" />
                  <div className="mx-auto mt-1 h-3 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
            {/* Heatmap skeleton */}
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm animate-pulse">
              <div className="h-3 w-28 rounded bg-muted mb-4" />
              <div className="flex gap-0.5">
                {Array.from({ length: 13 }).map((_, wi) => (
                  <div key={wi} className="flex flex-col gap-0.5">
                    {Array.from({ length: 7 }).map((_, di) => (
                      <div key={di} className="h-3 w-3 rounded-sm bg-muted/40" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Activity skeleton */}
            <div className="rounded-xl border bg-background/60 shadow-sm animate-pulse divide-y divide-border/50">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
            {/* Top Books skeleton */}
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm animate-pulse space-y-3">
              <div className="h-3 w-24 rounded bg-muted mb-3" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-5 rounded bg-muted" />
                  <div className="h-4 w-4 rounded bg-muted" />
                  <div className="flex-1 h-3 rounded bg-muted" />
                  <div className="h-3 w-10 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>

        {/* User Info */}
        <div className="rounded-xl border bg-background/60 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{user?.username || 'User'}</h1>
              <p className="text-sm text-muted-foreground">
                {analytics?.totalSessions || 0} reading session{analytics?.totalSessions !== 1 ? 's' : ''}
              </p>
            </div>
            {streakCount > 0 && (
              <div className="ml-auto flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 dark:border-orange-800/30 dark:bg-orange-950/20">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streakCount}</span>
                <span className="text-xs text-orange-500/70">day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* Today's Goal Progress */}
        {dailyGoalEnabled && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-500" />
                  Pages Today
                </span>
                <span className="text-xs font-bold text-foreground">{todayPages} / {dailyGoalPages}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pageProgress}%` }} />
              </div>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-violet-500" />
                  Reading Time
                </span>
                <span className="text-xs font-bold text-foreground">{formatMinutes(todayMinutes)} / {formatMinutes(dailyGoalMinutes)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${minuteProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Lifetime Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Library, value: analytics?.totalPages ?? '-', label: 'Total Pages' },
            { icon: Clock, value: analytics ? formatMinutes(analytics.totalMinutes) : '-', label: 'Total Time' },
            { icon: Brain, value: wordHistory.length, label: 'Words Looked Up' },
            { icon: BookMarked, value: bookmarks.length, label: 'Bookmarks' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl border bg-background/60 p-4 text-center shadow-sm">
              <Icon className="mx-auto h-4 w-4 text-emerald-500" />
              <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Secondary Stats */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Volume2, value: flashcards.length, label: 'Flashcards' },
            { icon: TrendingUp, value: analytics?.avgPagesPerDay != null ? analytics.avgPagesPerDay : '-', label: 'Pages / Day' },
            { icon: Zap, value: analytics?.readingSpeed != null ? `${analytics.readingSpeed}/hr` : '-', label: 'Reading Speed' },
            { icon: Target, value: analytics?.totalSessions ?? '-', label: 'Sessions' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl border bg-background/60 p-4 text-center shadow-sm">
              <Icon className="mx-auto h-4 w-4 text-emerald-500" />
              <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* GitHub-style Contribution Heatmap */}
        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Reading Activity</h2>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm overflow-x-auto">
              <div className="flex gap-0.5" style={{ minWidth: 400 }}>
                {(() => {
                  const today = new Date()
                  const weeks: { date: string; pages: number; active: boolean }[][] = []
                  let currentWeek: { date: string; pages: number; active: boolean }[] = []

                  const startDate = new Date(today)
                  startDate.setDate(startDate.getDate() - 90)

                  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    const record = history.find((r) => r.date === ds)
                    const pages = record?.pagesRead || 0
                    currentWeek.push({ date: ds, pages, active: !!record })

                    if (d.getDay() === 6) {
                      weeks.push(currentWeek)
                      currentWeek = []
                    }
                  }
                  if (currentWeek.length > 0) weeks.push(currentWeek)

                  const maxPages = Math.max(1, ...history.map((r) => r.pagesRead))

                  const getColor = (pages: number) => {
                    if (pages === 0) return 'bg-muted/40'
                    const ratio = pages / maxPages
                    if (ratio > 0.66) return 'bg-emerald-500'
                    if (ratio > 0.33) return 'bg-emerald-400'
                    return 'bg-emerald-300'
                  }

                  return (
                    <div className="flex gap-0.5">
                      {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-0.5">
                          {week.map((day) => (
                            <div
                              key={day.date}
                              className={`h-3 w-3 rounded-sm ${getColor(day.pages)}`}
                              title={`${day.date}: ${day.pages} pages`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 text-[9px] text-muted-foreground/60">
                <span>Less</span>
                <div className="h-2.5 w-2.5 rounded-sm bg-muted/40" />
                <div className="h-2.5 w-2.5 rounded-sm bg-emerald-300" />
                <div className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                <span>More</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Recent Activity</h2>
            <div className="rounded-xl border bg-background/60 shadow-sm divide-y divide-border/50">
              {history.slice(0, 10).map((entry) => {
                const d = new Date(entry.date + 'T00:00:00')
                const mins = Math.round(entry.timeSpentMs / 60000)
                return (
                  <div key={entry.date} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">
                      {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-foreground">{entry.pagesRead} pages</span>
                      {mins > 0 && <span className="text-muted-foreground/70">{mins}m</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top Books */}
        {analytics?.topBooks && analytics.topBooks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Most Read Books</h2>
            <div className="space-y-2">
              {analytics.topBooks.slice(0, 5).map((book, i) => (
                <div key={book.fileName} className="flex items-center gap-3 rounded-xl border bg-background/60 p-3 shadow-sm">
                  <span className="text-xs font-bold text-muted-foreground/50 w-5">{i + 1}</span>
                  <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{book.fileName}</span>
                  <span className="text-xs text-muted-foreground">{book.pages} pages</span>
                  <span className="text-xs text-muted-foreground/50">{formatMinutes(book.minutes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 transition-all active:scale-[0.97]"
          >
            <BookOpen className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
          </>
        )}
      </main>
    </div>
  )
}
