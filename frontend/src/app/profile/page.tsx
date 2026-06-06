'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BookOpen, User, LogOut, ArrowLeft, Flame, Target,
  Library, Clock, Brain, BookMarked, Volume2, TrendingUp,
  Zap, FileText, BarChart3, BookmarkCheck, ChevronRight,
  Sparkles, Award, Crown, Rocket, FlaskConical, Check, Loader2, X, Send, MessageSquareQuote, AlertCircle, Hourglass,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import Link from 'next/link'
import { PLAN_LABELS, PLAN_DESCRIPTIONS, type AIPlan } from '@/lib/ai-plan'
import { MIN_REQUEST_MESSAGE, MAX_REQUEST_MESSAGE, REQUEST_COOLDOWN_DAYS } from '@/lib/access-request'

const planIcon = (plan?: AIPlan | null) => {
  if (plan === 'founder') return <Crown className="h-3.5 w-3.5" />
  if (plan === 'pro') return <Rocket className="h-3.5 w-3.5" />
  if (plan === 'beta') return <FlaskConical className="h-3.5 w-3.5" />
  if (plan === 'admin') return <Sparkles className="h-3.5 w-3.5" />
  return <Sparkles className="h-3.5 w-3.5" />
}

const planBadgeClass = (plan?: AIPlan | null) => {
  if (plan === 'founder') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (plan === 'pro' || plan === 'admin') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
  if (plan === 'beta') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
}

const planOrder: AIPlan[] = ['free', 'pro', 'beta', 'founder']

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
  const [currentPlan, setCurrentPlan] = useState<AIPlan>('free')
  const [isUnlimited, setIsUnlimited] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<{ requestedPlan?: AIPlan | null; message?: string } | null>(null)
  const [lastDismissed, setLastDismissed] = useState<{
    dismissReason: string
    dismissedAt: string
    cooldownEndsAt: string
    daysRemaining: number
    active: boolean
  } | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [statsRes, goalRes, bmRes, histRes, fcRes, quotaRes] = await Promise.all([
          authFetch('/api/reading-stats?days=90&mode=analytics'),
          authFetch('/api/reading-goal'),
          authFetch('/api/db/bookmarks'),
          authFetch('/api/db/history'),
          authFetch('/api/flashcards'),
          authFetch('/api/ai/quota'),
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

        if (quotaRes.ok) {
          const q = await quotaRes.json()
          if (q.plan) setCurrentPlan(q.plan as AIPlan)
          setIsUnlimited(!!q.isUnlimited)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    loadAll()
  }, [])

  const loadPendingRequest = async () => {
    try {
      const res = await authFetch('/api/auth/me')
      if (!res.ok) return
      const data = await res.json()
      setPendingRequest(data?.pendingRequest || null)
      setLastDismissed(data?.lastDismissed || null)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadPendingRequest()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Tick every minute so the cooldown countdown stays fresh
  useEffect(() => {
    if (!lastDismissed?.active) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [lastDismissed?.active])

  const handleRequestPro = async () => {
    const trimmed = requestMessage.trim()
    if (trimmed.length < MIN_REQUEST_MESSAGE) {
      setRequestError(`Please tell us why you need Pro access (at least ${MIN_REQUEST_MESSAGE} characters).`)
      return
    }
    setRequesting(true)
    setRequestError(null)
    setRequestSuccess(false)
    try {
      const res = await authFetch('/api/ai/quota/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRequestError(data?.error || 'Failed to submit request')
        return
      }
      setRequestMessage('')
      setRequestSuccess(true)
      await loadPendingRequest()
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setRequesting(false)
    }
  }

  // Recompute live countdown from `now`
  const liveCooldown = (() => {
    if (!lastDismissed?.active) return null
    const endsAt = new Date(lastDismissed.cooldownEndsAt).getTime()
    const remaining = Math.max(0, endsAt - now)
    const days = Math.floor(remaining / 86400000)
    const hours = Math.floor((remaining % 86400000) / 3600000)
    const minutes = Math.floor((remaining % 3600000) / 60000)
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  })()

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
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-emerald-500/10 bg-background/60 px-4 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-500/20">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Profile</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:hover:border-red-900 dark:hover:bg-red-950/20"
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
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground sm:text-2xl">{user?.username || 'Reader'}</h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${planBadgeClass(currentPlan)}`}
                    title={PLAN_DESCRIPTIONS[currentPlan]}
                  >
                    {planIcon(currentPlan)}
                    {PLAN_LABELS[currentPlan]}
                  </span>
                  {user?.isAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                      Admin
                    </span>
                  )}
                </div>
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

        {/* ── SUBSCRIPTION ── */}
        <div className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-4 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            Subscription
          </h2>
          <div className="rounded-2xl border bg-background/60 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${planBadgeClass(currentPlan)}`}>
                  {planIcon(currentPlan)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-foreground">Current plan: {PLAN_LABELS[currentPlan]}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isUnlimited ? 'Unlimited AI access on every feature.' : PLAN_DESCRIPTIONS[currentPlan]}
                  </p>
                </div>
              </div>
              {pendingRequest && (
                <div className="inline-flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-300">
                  <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <span className="font-semibold">Request pending review</span>
                    {pendingRequest.message && (
                      <p className="mt-0.5 max-w-md text-[10px] italic text-amber-700/80 dark:text-amber-300/80">
                        &ldquo;{pendingRequest.message}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {currentPlan !== 'founder' && (
              <>
                <div className="my-5 h-px bg-border/60" />

                {/* Cooldown banner if a previous request was dismissed */}
                {lastDismissed?.active && !pendingRequest && (
                  <div className="mb-4 rounded-xl border border-red-200/60 bg-red-50/40 p-3.5 dark:border-red-800/30 dark:bg-red-950/10">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                          Previous request was declined
                          {liveCooldown && (
                            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                              <Hourglass className="h-2.5 w-2.5" />
                              {liveCooldown} left
                            </span>
                          )}
                        </p>
                        {lastDismissed.dismissReason && (
                          <div className="mt-1.5 flex gap-1.5 rounded-md border-l-2 border-red-400/60 bg-background/60 px-2 py-1.5">
                            <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0 text-red-500/70" />
                            <p className="text-[11px] italic leading-relaxed text-red-900/80 dark:text-red-200/80">
                              {lastDismissed.dismissReason}
                            </p>
                          </div>
                        )}
                        <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                          You can submit a new request in {REQUEST_COOLDOWN_DAYS} days from the dismissal.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!pendingRequest && (
                  <div className="rounded-xl border border-violet-300/40 bg-gradient-to-br from-violet-50/40 to-background p-4 dark:border-violet-700/30 dark:from-violet-950/20">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${planBadgeClass('pro')}`}>
                        <Rocket className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground">Request {PLAN_LABELS.pro}</h3>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {PLAN_DESCRIPTIONS.pro}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Why do you need Pro access?
                      </label>
                      <textarea
                        value={requestMessage}
                        onChange={(e) => { setRequestMessage(e.target.value); setRequestError(null); setRequestSuccess(false) }}
                        placeholder="Tell us a bit about how you'll use the AI features — what kinds of books you read, what would change for you, etc."
                        rows={4}
                        maxLength={MAX_REQUEST_MESSAGE}
                        disabled={requesting || !!lastDismissed?.active}
                        className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2.5 text-base placeholder:text-muted-foreground/50 focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                      />
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/60">
                        <span>Min {MIN_REQUEST_MESSAGE} characters</span>
                        <span className={requestMessage.length > MAX_REQUEST_MESSAGE - 50 ? 'text-amber-600' : ''}>
                          {requestMessage.length}/{MAX_REQUEST_MESSAGE}
                        </span>
                      </div>
                    </div>

                    {requestError && (
                      <p className="mt-2 text-[11px] text-red-500">{requestError}</p>
                    )}
                    {requestSuccess && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Request sent — an admin will review it shortly.
                      </p>
                    )}

                    <button
                      onClick={handleRequestPro}
                      disabled={requesting || requestMessage.trim().length < MIN_REQUEST_MESSAGE || !!lastDismissed?.active}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-violet-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none"
                    >
                      {requesting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending request…
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          {lastDismissed?.active ? 'Cooldown in effect' : 'Send Pro access request'}
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-[10px] text-muted-foreground/60">
                      Requests are reviewed manually. If declined, you won&apos;t be able to send another one for {REQUEST_COOLDOWN_DAYS} days.
                    </p>
                  </div>
                )}
              </>
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
