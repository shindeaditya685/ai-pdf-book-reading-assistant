'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Users, FileText, Bookmark, Brain, Shield, ShieldCheck, ShieldOff, ArrowLeft, Search, Loader2, Trash2, ChevronLeft, ChevronRight, Sparkles, Crown, FlaskConical, Rocket, MessageSquareQuote, Download, BarChart3, History, CheckCircle, XCircle, UserCog, UserMinus, UserPlus, LogOut, KeyRound, Megaphone, CheckCheck, Square, CheckSquare } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { PLAN_LABELS, PLAN_DESCRIPTIONS, type AIPlan } from '@/lib/ai-plan'
import { DISMISS_REASON_TEMPLATES, MIN_DISMISS_REASON } from '@/lib/access-request'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const PAGE_SIZE = 10

interface UserStats {
  pdfs: number
  bookmarks: number
  words: number
  annotations: number
}

interface AppUser {
  _id: string
  username: string
  isAdmin: boolean
  plan?: AIPlan
  isUnlimited?: boolean
  createdAt: string
  stats: UserStats
}

interface AccessRequest {
  _id: string
  userId: string
  username: string
  message: string
  requestedPlan?: AIPlan | null
  status: string
  createdAt: string
}

interface PlatformStats {
  users: number
  pdfs: number
  bookmarks: number
  annotations: number
  wordsLookedUp: number
  shareSessions: number
}

interface AnalyticsData {
  userSignups: { date: string; count: number }[]
  pdfUploads: { date: string; count: number }[]
  planBreakdown: { plan: string; count: number }[]
}

interface AuditEntry {
  _id: string
  adminUsername: string
  action: string
  targetUsername: string
  details: string
  createdAt: string
}

interface Announcement {
  _id: string
  title: string
  body: string
  createdBy: string
  createdAt: string
  expiresAt: string | null
  active: boolean
}

const ACTION_LABELS: Record<string, string> = {
  delete_user: 'Deleted User',
  promote_admin: 'Promoted to Admin',
  revoke_admin: 'Revoked Admin',
  change_plan: 'Changed Plan',
  grant_access: 'Granted Access',
  dismiss_access: 'Dismissed Request',
  bulk_plan_change: 'Bulk Plan Change',
  create_announcement: 'Created Announcement',
  delete_announcement: 'Deleted Announcement',
}

const ACTION_ICONS: Record<string, any> = {
  delete_user: UserMinus,
  promote_admin: UserPlus,
  revoke_admin: UserCog,
  change_plan: KeyRound,
  grant_access: CheckCircle,
  dismiss_access: XCircle,
  bulk_plan_change: Users,
  create_announcement: Megaphone,
  delete_announcement: Trash2,
}

const ACTION_COLORS: Record<string, string> = {
  delete_user: 'text-red-500 bg-red-50 dark:bg-red-950/20',
  promote_admin: 'text-violet-500 bg-violet-50 dark:bg-violet-950/20',
  revoke_admin: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20',
  change_plan: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
  grant_access: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
  dismiss_access: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20',
  bulk_plan_change: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/20',
  create_announcement: 'text-pink-500 bg-pink-50 dark:bg-pink-950/20',
  delete_announcement: 'text-rose-500 bg-rose-50 dark:bg-rose-950/20',
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AppUser[]>([])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'promote' | 'revoke' | 'plan'
    userId: string
    username: string
    plan?: AIPlan
  } | null>(null)

  // Dismiss-request dialog state (admin must supply a reason)
  const [dismissTarget, setDismissTarget] = useState<{ id: string; username: string } | null>(null)
  const [dismissReason, setDismissReason] = useState('')
  const [dismissing, setDismissing] = useState(false)
  const [dismissError, setDismissError] = useState('')
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})

  // Announcement creation state
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceExpiry, setAnnounceExpiry] = useState('')
  const [announceSubmitting, setAnnounceSubmitting] = useState(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPlanDialog, setBulkPlanDialog] = useState<{ plan?: AIPlan } | null>(null)

  // Bulk plan change dialog state (reuses existing confirmAction pattern)
  const [bulkConfirmAction, setBulkConfirmAction] = useState<{
    plan: AIPlan
  } | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (!user.isAdmin) { router.push('/dashboard'); return }

    const load = async () => {
      try {
        const [usersRes, statsRes, requestsRes, analyticsRes, auditRes, annRes] = await Promise.all([
          authFetch('/api/admin/users'),
          authFetch('/api/admin/stats'),
          authFetch('/api/admin/access-requests').catch(() => null),
          authFetch('/api/admin/analytics').catch(() => null),
          authFetch('/api/admin/audit-log').catch(() => null),
          authFetch('/api/admin/announcements').catch(() => null),
        ])
        if (!usersRes.ok || !statsRes.ok) { setError('Failed to load data'); return }
        const usersData = await usersRes.json()
        const statsData = await statsRes.json()
        const requestsData = requestsRes?.ok ? await requestsRes.json() : { requests: [] }
        const analyticsData = analyticsRes?.ok ? await analyticsRes.json() : null
        const auditData = auditRes?.ok ? await auditRes.json() : { entries: [] }
        const annData = annRes?.ok ? await annRes.json() : { announcements: [] }
        setUsers(usersData.users || [])
        setStats(statsData.stats || null)
        setAccessRequests((requestsData.requests || []).filter((r: AccessRequest) => r.status === 'pending'))
        setAnalytics(analyticsData)
        setAuditLog(auditData.entries || [])
        setAnnouncements(annData.announcements || [])
      } catch {
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, authLoading, router])

  const handleDeleteUser = async (userId: string) => {
    const res = await authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u._id !== userId))
    }
    setConfirmAction(null)
  }

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    const res = await authFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, makeAdmin }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isAdmin: makeAdmin } : u))
    }
    setConfirmAction(null)
  }

  const handleChangePlan = async (userId: string, plan: AIPlan) => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, plan } : u))
      setAccessRequests((prev) => prev.filter((r) => r.userId !== userId))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || 'Failed to change plan')
    }
    setConfirmAction(null)
  }

  const openDismissDialog = (requestId: string, username: string) => {
    setDismissTarget({ id: requestId, username })
    setDismissReason('')
    setDismissError('')
  }

  const handleDismissRequest = async () => {
    if (!dismissTarget) return
    if (dismissReason.trim().length < MIN_DISMISS_REASON) {
      setDismissError(`Reason must be at least ${MIN_DISMISS_REASON} characters.`)
      return
    }
    setDismissing(true)
    setDismissError('')
    const res = await authFetch(`/api/admin/access-requests/${dismissTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: dismissReason.trim() }),
    })
    setDismissing(false)
    if (res.ok) {
      setAccessRequests((prev) => prev.filter((r) => r._id !== dismissTarget.id))
      setDismissTarget(null)
      setDismissReason('')
    } else {
      const data = await res.json().catch(() => ({}))
      setDismissError(data?.error || 'Failed to dismiss request')
    }
  }

  const handleCreateAnnouncement = async () => {
    if (!announceTitle.trim() || !announceBody.trim()) return
    setAnnounceSubmitting(true)
    const res = await authFetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: announceTitle.trim(),
        body: announceBody.trim(),
        expiresAt: announceExpiry || null,
      }),
    })
    setAnnounceSubmitting(false)
    if (res.ok) {
      const data = await res.json()
      setAnnouncements((prev) => [data.announcement, ...prev])
      setAnnounceTitle('')
      setAnnounceBody('')
      setAnnounceExpiry('')
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || 'Failed to create announcement')
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    const res = await authFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAnnouncements((prev) => prev.filter((a) => a._id !== id))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || 'Failed to delete announcement')
    }
  }

  const handleBulkPlanChange = async (plan: AIPlan) => {
    const userIds = Array.from(selectedIds)
    const res = await authFetch('/api/admin/users/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, plan }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => selectedIds.has(u._id) ? { ...u, plan } : u))
      setSelectedIds(new Set())
      setBulkConfirmAction(null)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.error || 'Failed to change plans')
    }
  }

  const toggleSelectUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedUsers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedUsers.map((u) => u._id)))
    }
  }

  const planIcon = (plan?: AIPlan) => {
    if (plan === 'founder') return <Crown className="h-3 w-3" />
    if (plan === 'pro') return <Rocket className="h-3 w-3" />
    if (plan === 'beta') return <FlaskConical className="h-3 w-3" />
    if (plan === 'admin') return <ShieldCheck className="h-3 w-3" />
    return <Sparkles className="h-3 w-3" />
  }

  const planBadgeClass = (plan?: AIPlan) => {
    if (plan === 'founder') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (plan === 'pro') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
    if (plan === 'beta') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    if (plan === 'admin') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
  }

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 when search changes
   
  useEffect(() => { setPage(1) }, [search])

  const exportCSV = () => {
    const headers = ['Username', 'Role', 'Plan', 'Joined', 'PDFs', 'Words', 'Bookmarks', 'Annotations']
    const rows = users.map((u) => [
      u.username,
      u.isAdmin ? 'Admin' : 'User',
      PLAN_LABELS[u.plan || 'free'],
      new Date(u.createdAt).toLocaleDateString(),
      u.stats.pdfs,
      u.stats.words,
      u.stats.bookmarks,
      u.stats.annotations,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
   

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-emerald-500/10 bg-background/60 px-4 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/20 ring-1 ring-violet-500/20">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Admin Panel</span>
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Protected</span>
        </div>
        <div className="text-xs text-muted-foreground/60">
          Signed in as <span className="font-semibold text-foreground">{user?.username}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── PENDING ACCESS REQUESTS ── */}
        {accessRequests.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-50/40 p-4 shadow-sm backdrop-blur-sm dark:bg-amber-950/10">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">Pending AI Access Requests</h2>
                <p className="text-xs text-muted-foreground/70">
                  {accessRequests.length} user{accessRequests.length === 1 ? '' : 's'} want{accessRequests.length === 1 ? 's' : ''} full AI access
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {accessRequests.map((r) => {
                const expanded = !!expandedMessages[r._id]
                const message = r.message || ''
                const longMessage = message.length > 120
                return (
                  <div
                    key={r._id}
                    className="rounded-lg border border-amber-200/50 bg-background/80 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{r.username}</span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {new Date(r.createdAt).toLocaleString()}
                          </span>
                          {r.requestedPlan && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${planBadgeClass(r.requestedPlan)}`}>
                              {planIcon(r.requestedPlan)}
                              wants {PLAN_LABELS[r.requestedPlan]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => setConfirmAction({ type: 'plan', userId: r.userId, username: r.username, plan: r.requestedPlan || 'pro' })}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-500"
                        >
                          Grant{r.requestedPlan ? ` ${PLAN_LABELS[r.requestedPlan]}` : ''}
                        </button>
                        <button
                          onClick={() => openDismissDialog(r._id, r.username)}
                          className="rounded-md border border-border/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    {message && (
                      <div className="mt-2 flex gap-2 rounded-md border-l-2 border-amber-400/60 bg-amber-50/40 px-2.5 py-1.5 dark:bg-amber-950/20">
                        <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0 text-amber-600/70 dark:text-amber-400/70" />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] italic leading-relaxed text-amber-900/80 dark:text-amber-200/80 ${!expanded && longMessage ? 'line-clamp-2' : ''}`}>
                            {message}
                          </p>
                          {longMessage && (
                            <button
                              onClick={() => setExpandedMessages((prev) => ({ ...prev, [r._id]: !expanded }))}
                              className="mt-0.5 text-[10px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
                            >
                              {expanded ? 'Show less' : 'Read full message'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── STATS CARDS ── */}
        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, label: 'Total Users', value: stats.users, color: 'from-blue-500 to-blue-600' },
              { icon: FileText, label: 'PDFs Uploaded', value: stats.pdfs, color: 'from-emerald-500 to-emerald-600' },
              { icon: Bookmark, label: 'Bookmarks', value: stats.bookmarks, color: 'from-amber-500 to-amber-600' },
              { icon: Brain, label: 'Words Looked Up', value: stats.wordsLookedUp, color: 'from-violet-500 to-violet-600' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-xl border bg-background/60 p-5 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── ANALYTICS CHARTS ── */}
        {analytics && (
          <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]">
            {/* Daily Activity */}
            <div className="rounded-xl border bg-background/60 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Daily Activity (30 days)</h2>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'New Users', data: analytics.userSignups, color: '#6366f1' },
                  { label: 'PDF Uploads', data: analytics.pdfUploads, color: '#10b981' },
                ].map((series) => {
                  const max = Math.max(...series.data.map((d) => d.count), 1)
                  return (
                    <div key={series.label}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{series.label}</p>
                      <div className="flex items-end gap-0.5 h-16">
                        {series.data.map((d) => (
                          <div
                            key={d.date}
                            className="flex-1 rounded-t transition-all hover:opacity-80"
                            style={{
                              height: `${(d.count / max) * 100}%`,
                              backgroundColor: series.color,
                              opacity: 0.3 + (d.count / max) * 0.7,
                              minHeight: d.count > 0 ? 4 : 0,
                            }}
                            title={`${d.date}: ${d.count}`}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Plan Breakdown */}
            <div className="w-64 rounded-xl border bg-background/60 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Plans</h2>
              </div>
              {(() => {
                const total = analytics.planBreakdown.reduce((s, p) => s + p.count, 0)
                const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                let cumulative = 0
                return (
                  <div className="space-y-3">
                    <div className="flex h-4 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                      {analytics.planBreakdown.map((p, i) => {
                        const pct = (p.count / total) * 100
                        const start = cumulative
                        cumulative += pct
                        return (
                          <div
                            key={p.plan}
                            style={{
                              width: `${pct}%`,
                              backgroundColor: colors[i % colors.length],
                            }}
                            title={`${p.plan}: ${p.count}`}
                          />
                        )
                      })}
                    </div>
                    <div className="space-y-1.5">
                      {analytics.planBreakdown.map((p, i) => {
                        const pct = total > 0 ? Math.round((p.count / total) * 100) : 0
                        return (
                          <div key={p.plan} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                              <span className="font-medium capitalize text-foreground">{PLAN_LABELS[p.plan as AIPlan] || p.plan}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">{p.count} ({pct}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        <div className="mb-6 rounded-xl border bg-background/60 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-border/40 p-4">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">Announcements</h2>
            <span className="text-[10px] text-muted-foreground/60">Broadcast messages to all users</span>
          </div>
          <div className="p-4">
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="Announcement title..."
                className="h-9 rounded-lg border border-border/60 bg-background/80 px-3 text-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              />
              <input
                type="text"
                value={announceBody}
                onChange={(e) => setAnnounceBody(e.target.value)}
                placeholder="Message body..."
                className="h-9 rounded-lg border border-border/60 bg-background/80 px-3 text-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={announceExpiry}
                  onChange={(e) => setAnnounceExpiry(e.target.value)}
                  className="h-9 rounded-lg border border-border/60 bg-background/80 px-3 text-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
                  title="Expiry date (optional)"
                />
                <button
                  onClick={handleCreateAnnouncement}
                  disabled={announceSubmitting || !announceTitle.trim() || !announceBody.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
                >
                  {announceSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
                  Send
                </button>
              </div>
            </div>

            {announcements.length > 0 ? (
              <div className="space-y-2">
                {announcements.map((a) => (
                  <div key={a._id} className="flex items-start justify-between rounded-lg border border-border/30 bg-muted/20 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        {a.expiresAt && new Date(a.expiresAt) > new Date() && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Active</span>
                        )}
                        {a.expiresAt && new Date(a.expiresAt) <= new Date() && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">Expired</span>
                        )}
                        {!a.expiresAt && (
                          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">Ongoing</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">{a.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/40">
                        By {a.createdBy} &middot; {new Date(a.createdAt).toLocaleDateString()}
                        {a.expiresAt && <> &middot; Expires {new Date(a.expiresAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(a._id)}
                      className="ml-3 rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                      title="Delete announcement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground/50">No announcements yet. Create one above.</p>
            )}
          </div>
        </div>

        {/* ── USERS TABLE ── */}
        <div className="rounded-xl border bg-background/60 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 border-b border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Users</h2>
              <p className="text-xs text-muted-foreground/60">{users.length} registered users</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                title="Export as CSV"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
              <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username..."
                className="h-10 w-full rounded-lg border border-border/60 bg-background/80 pl-9 pr-3 text-base outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 sm:h-9 sm:w-64 sm:text-sm"
              />
            </div>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 border-b border-border/40 bg-violet-50/50 px-4 py-2 dark:bg-violet-950/10">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
              </p>
              <div className="h-3 w-px bg-border/40" />
              <button
                onClick={() => setBulkConfirmAction({ plan: 'free' as AIPlan })}
                className="rounded-md bg-violet-600 px-3 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Change Plan
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-md px-3 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground/60">
                  <th className="w-10 px-2 py-3">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {selectedIds.size === paginatedUsers.length && paginatedUsers.length > 0
                        ? <CheckSquare className="h-4 w-4 text-violet-500" />
                        : <Square className="h-4 w-4 text-muted-foreground/50" />
                      }
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Username</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">PDFs</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Words</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Bookmarks</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Annotations</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => (
                  <tr key={u._id} className={`border-b border-border/20 transition-colors hover:bg-muted/30 ${selectedIds.has(u._id) ? 'bg-violet-50/50 dark:bg-violet-950/10' : ''}`}>
                    <td className="px-2 py-3">
                      <button onClick={() => toggleSelectUser(u._id)} className="flex items-center justify-center">
                        {selectedIds.has(u._id)
                          ? <CheckSquare className="h-4 w-4 text-violet-500" />
                          : <Square className="h-4 w-4 text-muted-foreground/30" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-violet-600 shadow-sm">
                          <span className="text-[10px] font-bold text-white">{u.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-foreground">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.isAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setConfirmAction({ type: 'plan', userId: u._id, username: u.username, plan: u.plan })}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80 ${planBadgeClass(u.plan)}`}
                        title="Click to change plan"
                      >
                        {planIcon(u.plan)}
                        {PLAN_LABELS[u.plan || 'free']}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/70">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.pdfs}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.words}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.bookmarks}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.annotations}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {u.isAdmin ? (
                          <button
                            onClick={() => setConfirmAction({ type: 'revoke', userId: u._id, username: u.username })}
                            className="rounded-md px-2 py-1 text-[10px] font-semibold text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/20"
                            title="Revoke admin"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmAction({ type: 'promote', userId: u._id, username: u.username })}
                            className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                            title="Make admin"
                          >
                            Promote
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmAction({ type: 'delete', userId: u._id, username: u.username })}
                          className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                          title="Delete user"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginatedUsers.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/50">No users found</p>
              </div>
            )}
          </div>

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
              <p className="text-[11px] text-muted-foreground/60">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition-colors ${
                      p === page
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── AUDIT LOG ── */}
        {auditLog.length > 0 && (
          <div className="mt-8 rounded-xl border bg-background/60 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-border/40 p-4">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold text-foreground">Audit Log</h2>
              <span className="text-[10px] text-muted-foreground/60">Recent admin actions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground/60">
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Admin</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Target</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Details</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => {
                    const Icon = ACTION_ICONS[entry.action] || LogOut
                    const colorClass = ACTION_COLORS[entry.action] || 'text-muted-foreground bg-muted/30'
                    return (
                      <tr key={entry._id} className="border-b border-border/20 transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
                            <Icon className="h-3 w-3" />
                            {ACTION_LABELS[entry.action] || entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{entry.adminUsername}</td>
                        <td className="px-4 py-3 text-muted-foreground/70">{entry.targetUsername}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-muted-foreground/50">{entry.details}</td>
                        <td className="px-4 py-3 text-muted-foreground/70 whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {auditLog.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <History className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/50">No audit entries yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── CONFIRMATION DIALOG ── */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'delete' && 'Delete User'}
              {confirmAction?.type === 'promote' && 'Promote to Admin'}
              {confirmAction?.type === 'revoke' && 'Revoke Admin'}
              {confirmAction?.type === 'plan' && `Change Plan for ${confirmAction.username}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete' && (
                <>This will permanently delete <strong>{confirmAction.username}</strong> and all their data (PDFs, bookmarks, history, annotations). This action cannot be undone.</>
              )}
              {confirmAction?.type === 'promote' && (
                <>Are you sure you want to make <strong>{confirmAction.username}</strong> an admin? They will have full access to the admin panel.</>
              )}
              {confirmAction?.type === 'revoke' && (
                <>Are you sure you want to remove <strong>{confirmAction.username}</strong>&apos;s admin privileges?</>
              )}
              {confirmAction?.type === 'plan' && (
                <>Select a new plan for <strong>{confirmAction.username}</strong>. Changes take effect immediately.</>
              )}
            </AlertDialogDescription>
            {confirmAction?.type === 'plan' && (
              <div className="mt-3 grid gap-2">
                {(['free', 'pro', 'beta', 'founder'] as AIPlan[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      if (confirmAction) handleChangePlan(confirmAction.userId, p)
                    }}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${
                      confirmAction.plan === p ? 'border-violet-500/40 bg-violet-500/5' : 'border-border/60'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {planIcon(p)}
                      {PLAN_LABELS[p]}
                    </span>
                    <span className="text-muted-foreground/70">{PLAN_DESCRIPTIONS[p]}</span>
                  </button>
                ))}
              </div>
            )}
          </AlertDialogHeader>
          {confirmAction && (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {confirmAction.type !== 'plan' && (
                <AlertDialogAction
                  className={
                    confirmAction.type === 'delete'
                      ? 'bg-red-600 hover:bg-red-500'
                      : confirmAction.type === 'promote'
                      ? 'bg-violet-600 hover:bg-violet-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }
                  onClick={() => {
                    if (confirmAction.type === 'delete') handleDeleteUser(confirmAction.userId)
                    else if (confirmAction.type === 'promote') handleToggleAdmin(confirmAction.userId, true)
                    else if (confirmAction.type === 'revoke') handleToggleAdmin(confirmAction.userId, false)
                  }}
                >
                  {confirmAction.type === 'delete' && 'Delete'}
                  {confirmAction.type === 'promote' && 'Promote'}
                  {confirmAction.type === 'revoke' && 'Revoke'}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── DISMISS REQUEST DIALOG (requires a reason) ── */}
      <AlertDialog open={!!dismissTarget} onOpenChange={(open) => { if (!open) { setDismissTarget(null); setDismissError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss {dismissTarget?.username}&apos;s request</AlertDialogTitle>
            <AlertDialogDescription>
              Please tell the user why their request is being declined. This message is shown to them and they won&apos;t be able to send another request for a few days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Reason</label>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Explain why this request is being declined…"
                rows={4}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2.5 text-base placeholder:text-muted-foreground/50 focus:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:text-sm"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/60">
                <span>Min {MIN_DISMISS_REASON} characters</span>
                <span className={dismissReason.length > 450 ? 'text-amber-600' : ''}>{dismissReason.length}/500</span>
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Quick templates</span>
              <div className="flex flex-wrap gap-1.5">
                {DISMISS_REASON_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => setDismissReason(tpl)}
                    className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-amber-400/40 hover:bg-amber-50/40 hover:text-amber-700 dark:hover:bg-amber-950/20 dark:hover:text-amber-300"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>
            {dismissError && (
              <p className="text-xs text-red-500">{dismissError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dismissing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDismissRequest() }}
              disabled={dismissing || dismissReason.trim().length < MIN_DISMISS_REASON}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
            >
              {dismissing && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {dismissing ? 'Dismissing…' : 'Dismiss request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── BULK PLAN CHANGE DIALOG ── */}
      <AlertDialog open={!!bulkConfirmAction} onOpenChange={() => setBulkConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Plan for {selectedIds.size} Users</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new plan for all <strong>{selectedIds.size}</strong> selected users. Changes take effect immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-1 grid gap-2">
            {(['free', 'pro', 'beta', 'founder'] as AIPlan[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setBulkConfirmAction(null)
                  handleBulkPlanChange(p)
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${
                  bulkConfirmAction?.plan === p ? 'border-violet-500/40 bg-violet-500/5' : 'border-border/60'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {planIcon(p)}
                  {PLAN_LABELS[p]}
                </span>
                <span className="text-muted-foreground/70">{PLAN_DESCRIPTIONS[p]}</span>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
