'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Users, FileText, Bookmark, Brain, Shield, ShieldCheck, ShieldOff, ArrowLeft, Search, Loader2, Trash2, ChevronLeft, ChevronRight, Sparkles, Crown, FlaskConical, Rocket, MessageSquareQuote } from 'lucide-react'
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

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AppUser[]>([])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
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

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (!user.isAdmin) { router.push('/dashboard'); return }

    const load = async () => {
      try {
        const [usersRes, statsRes, requestsRes] = await Promise.all([
          authFetch('/api/admin/users'),
          authFetch('/api/admin/stats'),
          authFetch('/api/admin/access-requests').catch(() => null),
        ])
        if (!usersRes.ok || !statsRes.ok) { setError('Failed to load data'); return }
        const usersData = await usersRes.json()
        const statsData = await statsRes.json()
        const requestsData = requestsRes?.ok ? await requestsRes.json() : { requests: [] }
        setUsers(usersData.users || [])
        setStats(statsData.stats || null)
        setAccessRequests((requestsData.requests || []).filter((r: AccessRequest) => r.status === 'pending'))
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

  const planIcon = (plan?: AIPlan) => {
    if (plan === 'founder') return <Crown className="h-3 w-3" />
    if (plan === 'pro') return <Rocket className="h-3 w-3" />
    if (plan === 'beta') return <FlaskConical className="h-3 w-3" />
    if (plan === 'admin') return <ShieldCheck className="h-3 w-3" />
    return <Sparkles className="h-3 w-3" />
  }

  const planBadgeClass = (plan?: AIPlan) => {
    if (plan === 'founder') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (plan === 'admin' || plan === 'pro') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
    if (plan === 'beta') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
  }

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 when search changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setPage(1) }, [search])
  /* eslint-enable react-hooks/set-state-in-effect */

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

        {/* ── USERS TABLE ── */}
        <div className="rounded-xl border bg-background/60 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 border-b border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Users</h2>
              <p className="text-xs text-muted-foreground/60">{users.length} registered users</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username..."
                className="h-9 w-64 rounded-lg border border-border/60 bg-background/80 pl-9 pr-3 text-xs outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground/60">
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
                  <tr key={u._id} className="border-b border-border/20 transition-colors hover:bg-muted/30">
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
                className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
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
    </div>
  )
}
