'use client'

import Link from 'next/link'
import { LogOut, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

export function LandingNav() {
  const { user, logout } = useAuth()

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.97]"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
            <span className="text-[10px] font-bold text-white">{user.username.charAt(0).toUpperCase()}</span>
          </div>
          <span className="hidden max-w-[100px] truncate sm:inline font-medium">{user.username}</span>
          <button
            onClick={logout}
            className="ml-0.5 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
            title="Sign out"
          >
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="relative rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:text-foreground"
      >
        Sign In
      </Link>
      <Link
        href="/register"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/20 transition-all hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.97]"
      >
        Get Started Free
      </Link>
    </div>
  )
}
