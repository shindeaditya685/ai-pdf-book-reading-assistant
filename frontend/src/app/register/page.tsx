'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const err = await register(username, password)
    setLoading(false)
    if (err) { setError(err); return }
    router.push('/dashboard')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/30">
      {/* Decorative blobs */}
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-emerald-400/20 blur-[120px] dark:bg-emerald-500/10" />
      <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-teal-400/20 blur-[120px] dark:bg-teal-500/10" />
      <div className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-300/10 blur-[100px] dark:bg-emerald-400/5" />

      <div className="relative w-full max-w-sm">
        {/* Decorative top ring */}
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-emerald-500/10 to-transparent blur-sm" />

        <div className="relative rounded-2xl border border-emerald-500/10 bg-background/70 p-8 shadow-2xl shadow-emerald-500/5 backdrop-blur-xl">
          {/* Logo */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/20">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Create account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground/70">Start your reading journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground/80">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
                placeholder="Choose a username"
                minLength={3}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80">Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
                placeholder="Repeat your password"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 px-3.5 py-2.5 dark:border-red-900/30 dark:bg-red-950/10">
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/20 transition-all hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Create account</span>
              )}
            </button>
          </form>

          <div className="relative mt-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="flex items-center gap-1.5 bg-background px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                <Shield className="h-3 w-3" />
                Free forever
              </span>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground/60">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
