'use client'

import Link from 'next/link'
import { BookOpen, LogOut, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

export function LandingNav() {
  const { user, logout } = useAuth()

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600 hover:shadow-md active:scale-[0.97]"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground">
          <span className="hidden max-w-[110px] truncate sm:inline">{user.username}</span>
          <button
            onClick={logout}
            className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-red-500"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign In
      </Link>
      <Link
        href="/register"
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600 hover:shadow-md active:scale-[0.97]"
      >
        Get Started Free
      </Link>
    </div>
  )
}
