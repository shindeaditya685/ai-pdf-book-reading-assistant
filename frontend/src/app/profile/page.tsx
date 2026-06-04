'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BookOpen, User, LogOut, ArrowLeft, Flame, Target,
  Library, Clock, Brain, BookMarked, Volume2, TrendingUp,
  Zap, FileText, BarChart3, BookmarkCheck, ChevronRight,
  Sparkles, Award,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import Link from 'next/link'

interface ReadingAnalytics {
  totalPages: number
  totalMinutes: number
  totalSessions: number
  avgPagesPerDay: number
  avgMinutesPerDay: number
  readingSpeed: number
  daysActive: number
  dailyActivity: { date: string; pages: number; minutes: number }[]
  bookBreakdown: { pdfFileName: string; pages: number; minutes: number }[]
}

interface DailyRecord {
  date: string
  pagesRead: number
  timeSpentMs: number
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [analytics, setAnalytics] = useState<ReadingAnalytics | null>(null)
  const [history, setHistory] = useState<DailyRecord[]>([])
  const [streak, setStreak] = useState(0)
  const [todayPages, setTodayPages] = useState(0)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [bookmarkCount, setBookmarkCount] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [flashcardCount, setFlashcardCount] = useState(0)
  const [dailyGoal, setDailyGoal] = useState({ enabled: false, pages: 10, minutes: 30 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [statsRes, goalRes, bmRes, histRes, fcRes] = await Promise.all([
          authFetch('/api/reading-stats?days=90&mode=analytics'),
          authFetch('/api/reading-goal'),
          authFetch('/api/db/bookmarks'),
          authFetch('/api/db/history'),
          authFetch('/api/flashcards'),
        ])

        if (statsRes.ok) {
          const data = await statsRes.json()
          setAnalytics(data.analytics)
          setHistory(data.history || [])
          setStreak(data.streak || 0)
          if (data.today) {
            setTodayPages(data.today.pagesRead || 0)
            setTodayMinutes(Math.round((data.today.timeSpentMs || 0) / 60000))
          }
        }

        if (goalRes.ok) {
          const g = await goalRes.json()
          setDailyGoal({ enabled: g.enabled || false, pages: g.pages || 10, minutes: g.minutes || 30 })
        }

        if (bmRes.ok) {
          const bm = await bmRes.json()
          setBookmarkCount(bm.length)
        }

        if (histRes.ok) {
          const hist = await histRes.json()
          setWordCount(hist.length)
        }

        if (fcRes.ok) {
          const fc = await fcRes.json()
          setFlashcardCount(fc.length)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    loadAll()
  }, [])

  const handleLogout = () => { logout(); router.push('/') }

  const formatMinutes = (m: number) => {
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    const r = m % 60
    return r > 0 ? `${h}h ${r}m` : `${h}h`
  }

  const pageProgress = dailyGoal.enabled && dailyGoal.pages > 0
    ? Math.min(100, Math.round((todayPages / dailyGoal.pages) * 100)) : 0
  const minuteProgress = dailyGoal.enabled && dailyGoal.minutes > 0
    ? Math.min(100, Math.round((todayMinutes / dailyGoal.minutes) * 100)) : 0

  const colors = [
    'from-emerald-500 to-emerald-600',
    'from-violet-500 to-violet-600',
    'from-amber-500 to-amber-600',
    'from-sky-500 to-sky-600',
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <header className="flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-lg">
          <Link href="/dashboard" className="rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 space-y-6">
          <div className="h-40 animate-pulse rounded-2xl bg-muted/50" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/50" />)}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-48 animate-pulse rounded-xl bg-muted/50" />
        </div>
      </div>
    )
  }

  const topBooks = analytics?.bookBreakdown?.slice(0, 5) || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Profile</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-red-500 hover:border-red-200 dark:hover:border-red-900 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── HERO CARD ── */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-background to-background p-6 sm:p-8 shadow-sm">
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <span className="text-2xl font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                {streak > 0 && (
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 shadow-md">
                    <Flame className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">{user?.username || 'Reader'}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-emerald-500" />
                    {analytics?.totalSessions || 0} sessions
                  </span>
                  {analytics && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="inline-flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5 text-violet-500" />
                        {analytics.daysActive} days active
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {streak > 0 && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-orange-200/60 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-2.5 dark:border-orange-800/20 dark:from-orange-950/20 dark:to-amber-950/20">
                <Flame className="h-5 w-5 text-orange-500" />
                <div>
                  <span className="text-lg font-black text-orange-600 dark:text-orange-400">{streak}</span>
                  <span className="ml-1 text-xs font-semibold text-orange-500/70">day streak</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── TODAY'S PROGRESS ── */}
        {dailyGoal.enabled && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="group rounded-xl border bg-background/60 p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-400/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-500" />
                  Pages Today
                </span>
                <span className="text-sm font-bold text-foreground tabular-nums">{todayPages} <span className="text-xs font-normal text-muted-foreground">/ {dailyGoal.pages}</span></span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                  style={{ width: `${pageProgress}%` }}
                />
              </div>
            </div>
            <div className="group rounded-xl border bg-background/60 p-5 shadow-sm transition-all hover:shadow-md hover:border-violet-400/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-violet-500" />
                  Reading Time
                </span>
                <span className="text-sm font-bold text-foreground tabular-nums">{formatMinutes(todayMinutes)} <span className="text-xs font-normal text-muted-foreground">/ {formatMinutes(dailyGoal.minutes)}</span></span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-500 transition-all duration-500"
                  style={{ width: `${minuteProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STATS GRID ── */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Library, label: 'Total Pages', value: analytics?.totalPages ?? 0, gradient: 'from-emerald-500 to-emerald-600' },
            { icon: Clock, label: 'Total Time', value: analytics ? formatMinutes(analytics.totalMinutes) : '0m', gradient: 'from-violet-500 to-violet-600' },
            { icon: Brain, label: 'Words Looked Up', value: wordCount, gradient: 'from-amber-500 to-amber-600' },
            { icon: BookMarked, label: 'Bookmarks', value: bookmarkCount, gradient: 'from-sky-500 to-sky-600' },
          ].map(({ icon: Icon, label, value, gradient }) => (
            <div key={label} className="group relative overflow-hidden rounded-xl border bg-background/60 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className={`absolute -right-4 -top-4 h-12 w-12 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-xl`} />
              <div className={`inline-flex rounded-lg bg-gradient-to-br ${gradient} p-2 shadow-sm`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground tabular-nums">{value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* ── SECONDARY STATS ── */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Volume2, label: 'Flashcards', value: flashcardCount },
            { icon: TrendingUp, label: 'Pages / Day', value: analytics?.avgPagesPerDay ?? '-' },
            { icon: Zap, label: 'Reading Speed', value: analytics?.readingSpeed != null ? `${analytics.readingSpeed}/hr` : '-' },
            { icon: Target, label: 'Sessions', value: analytics?.totalSessions ?? '-' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border bg-muted/30 p-4 text-center shadow-sm transition-all hover:bg-muted/50">
              <Icon className="mx-auto h-4 w-4 text-muted-foreground/60" />
              <p className="mt-2 text-lg font-bold text-foreground tabular-nums">{value}</p>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* ── GITHUB-STYLE CONTRIBUTION HEATMAP ── */}
        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-4 flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
              Reading Activity — Last 90 Days
            </h2>
            <div className="rounded-xl border bg-background/60 p-5 shadow-sm overflow-x-auto">
              <div className="flex gap-0.5">
                {(() => {
                  const today = new Date()
                  const weeks: { date: string; pages: number }[][] = []
                  let currentWeek: { date: string; pages: number }[] = []
                  const startDate = new Date(today)
                  startDate.setDate(startDate.getDate() - 90)
                  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    const record = history.find(r => r.date === ds)
                    currentWeek.push({ date: ds, pages: record?.pagesRead || 0 })
                    if (d.getDay() === 6) { weeks.push(currentWeek); currentWeek = [] }
                  }
                  if (currentWeek.length > 0) weeks.push(currentWeek)
                  const maxPages = Math.max(1, ...history.map(r => r.pagesRead))
                  const hue = (pages: number) => {
                    if (pages === 0) return 'bg-muted/30'
                    const r = pages / maxPages
                    if (r > 0.66) return 'bg-emerald-500'
                    if (r > 0.33) return 'bg-emerald-400'
                    return 'bg-emerald-300'
                  }
                  return weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-0.5">
                      {week.map(day => (
                        <div
                          key={day.date}
                          className={`h-3 w-3 rounded-sm ${hue(day.pages)} transition-colors`}
                          title={`${day.date}: ${day.pages} pages`}
                        />
                      ))}
                    </div>
                  ))
                })()}
              </div>
              <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/50">
                <span>Less</span>
                <div className="h-3 w-3 rounded-sm bg-muted/30" />
                <div className="h-3 w-3 rounded-sm bg-emerald-300" />
                <div className="h-3 w-3 rounded-sm bg-emerald-400" />
                <div className="h-3 w-3 rounded-sm bg-emerald-500" />
                <span>More</span>
              </div>
            </div>
          </div>
        )}

        {/* ── RECENT ACTIVITY ── */}
        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-4 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-violet-500" />
              Recent Activity
            </h2>
            <div className="rounded-xl border bg-background/60 shadow-sm divide-y divide-border/50 overflow-hidden">
              {history.slice(0, 7).map((entry) => {
                const d = new Date(entry.date + 'T00:00:00')
                const mins = Math.round(entry.timeSpentMs / 60000)
                return (
                  <div key={entry.date} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${entry.pagesRead > 0 ? 'bg-emerald-500' : 'bg-muted'}`} />
                      <span className="text-sm text-muted-foreground">
                        {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {entry.pagesRead > 0 && (
                        <span className="font-medium text-foreground tabular-nums">{entry.pagesRead} pages</span>
                      )}
                      {mins > 0 && (
                        <span className="text-muted-foreground/60 tabular-nums">{mins}m</span>
                      )}
                      {entry.pagesRead === 0 && mins === 0 && (
                        <span className="text-muted-foreground/30 text-xs">No activity</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── TOP BOOKS ── */}
        {topBooks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-4 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-amber-500" />
              Most Read Books
            </h2>
            <div className="space-y-2">
              {topBooks.map((book, i) => (
                <div
                  key={book.pdfFileName}
                  className="group flex items-center gap-4 rounded-xl border bg-background/60 p-4 shadow-sm transition-all hover:shadow-md hover:border-emerald-400/30"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${colors[i % colors.length]} text-xs font-bold text-white shadow-sm`}>
                    {i + 1}
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{book.pdfFileName}</span>
                  <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                    <span className="tabular-nums">{book.pages} pages</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="tabular-nums">{formatMinutes(book.minutes)}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="mt-10">
          <Link
            href="/dashboard"
            className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.98]"
          >
            <BookOpen className="h-4 w-4" />
            Back to Dashboard
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </main>
    </div>
  )
}
