'use client'

import Link from 'next/link'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

interface AuthCTAProps {
  primaryLabel?: string
  className?: string
}

export function AuthCTA({ primaryLabel, className }: AuthCTAProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className={`mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center ${className || ''}`}>
        <div className="h-12 w-44 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-12 w-28 animate-pulse rounded-xl bg-muted/30" />
      </div>
    )
  }

  if (user) {
    return (
      <div className={`mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center ${className || ''}`}>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 hover:shadow-xl active:scale-[0.97]"
        >
          <LayoutDashboard className="h-4 w-4" />
          Go to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className={`mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center ${className || ''}`}>
      <Link
        href="/register"
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.97]"
      >
        {primaryLabel || 'Start Reading Free'}
        <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-xl border bg-background px-8 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.97]"
      >
        Sign In
      </Link>
    </div>
  )
}
