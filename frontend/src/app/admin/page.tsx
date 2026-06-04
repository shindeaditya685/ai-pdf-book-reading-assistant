'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Users, FileText, Bookmark, Brain, MessageSquare, Trash2, Shield, ShieldCheck, BarChart3, ArrowLeft, Search, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

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
  createdAt: string
  stats: UserStats
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (!user.isAdmin) { router.push('/dashboard'); return }

    const load = async () => {
      try {
        const [usersRes, statsRes] = await Promise.all([
          authFetch('/api/admin/users'),
          authFetch('/api/admin/stats'),
        ])
        if (!usersRes.ok || !statsRes.ok) { setError('Failed to load data'); return }
        const usersData = await usersRes.json()
        const statsData = await statsRes.json()
        setUsers(usersData.users || [])
        setStats(statsData.stats || null)
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
      setConfirmDelete(null)
    }
  }

  const handleMakeAdmin = async (userId: string) => {
    const res = await authFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isAdmin: true } : u))
    }
  }

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )

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
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">PDFs</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Words</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Bookmarks</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Annotations</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
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
                    <td className="px-4 py-3 text-muted-foreground/70">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.pdfs}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.words}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.bookmarks}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground/70">{u.stats.annotations}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {!u.isAdmin && (
                          <button
                            onClick={() => handleMakeAdmin(u._id)}
                            className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                            title="Make admin"
                          >
                            Promote
                          </button>
                        )}
                        {confirmDelete === u._id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteUser(u._id)}
                              className="rounded-md px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(u._id)}
                            className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/50">No users found</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
