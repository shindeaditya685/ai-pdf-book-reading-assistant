'use client'

import { useState } from 'react'
import { Clock, Sparkles, Crown, Rocket, FlaskConical, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/api'
import {
  PLAN_LABELS,
  PLAN_DESCRIPTIONS,
  type AIFeature,
  type AIPlan,
} from '@/lib/ai-plan'
import { remainingFor, type QuotaState } from '@/hooks/use-ai-quota'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: QuotaState
  onRequested?: () => void
}

const FEATURE_META: { key: AIFeature; label: string; description: string }[] = [
  { key: 'summary', label: 'AI Summaries', description: 'Generate concise chapter summaries' },
  { key: 'question', label: 'AI Questions', description: 'Generate comprehension questions' },
  { key: 'translation', label: 'Word Translations', description: 'Translate and explain words in context' },
]

function planIcon(plan: AIPlan) {
  if (plan === 'founder') return <Crown className="h-4 w-4" />
  if (plan === 'pro') return <Rocket className="h-4 w-4" />
  if (plan === 'beta') return <FlaskConical className="h-4 w-4" />
  return <Sparkles className="h-4 w-4" />
}

function planBadgeClass(plan: AIPlan) {
  if (plan === 'founder') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (plan === 'pro') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
  if (plan === 'beta') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (plan === 'admin') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
}

export function AIQuotaModal({ open, onOpenChange, state, onRequested }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  if (!open) return null

  const handleRequest = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await authFetch('/api/ai/quota/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Failed to submit request')
        return
      }
      setSubmitted(true)
      onRequested?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const resetAt = state.resetAt ? new Date(state.resetAt) : null
  const hoursToReset = resetAt ? Math.max(0, Math.round((resetAt.getTime() - Date.now()) / 3_600_000)) : 0
  const minutesToReset = resetAt
    ? Math.max(0, Math.round(((resetAt.getTime() - Date.now()) % 3_600_000) / 60_000))
    : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/60 bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${planBadgeClass(state.plan)}`}>
            {planIcon(state.plan)}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground">Your AI Plan</h2>
            <p className="text-xs text-muted-foreground">{PLAN_DESCRIPTIONS[state.plan]}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${planBadgeClass(state.plan)}`}>
            {PLAN_LABELS[state.plan]}
          </span>
        </div>

        {!state.isUnlimited && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200/50 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Quotas reset in <strong>{hoursToReset}h {minutesToReset}m</strong> (midnight UTC)
            </span>
          </div>
        )}

        <div className="mb-5 space-y-2">
          {FEATURE_META.map((f) => {
            const remaining = remainingFor(state, f.key)
            const limit = state.limits[f.key]
            const used =
              f.key === 'summary'
                ? state.usage.summaries
                : f.key === 'question'
                ? state.usage.questions
                : state.usage.translations
            const pct = state.isUnlimited ? 0 : limit > 0 ? Math.min(100, (used / limit) * 100) : 0
            const isOut = !state.isUnlimited && remaining === 0
            return (
              <div key={f.key} className="rounded-lg border border-border/40 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground/70">{f.description}</p>
                  </div>
                  <div className="text-right">
                    {state.isUnlimited ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">∞</span>
                    ) : (
                      <span className={`text-xs font-bold tabular-nums ${isOut ? 'text-red-500' : 'text-foreground'}`}>
                        {used} / {limit}
                      </span>
                    )}
                  </div>
                </div>
                {!state.isUnlimited && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className={`h-full transition-all ${
                        isOut ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!state.isUnlimited && (
          <div className="rounded-lg border border-violet-200/50 bg-violet-50/40 p-3 dark:border-violet-900/30 dark:bg-violet-950/20">
            {submitted ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" />
                <span>Request sent! An admin will review your account soon.</span>
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs font-semibold text-foreground">Need more? Request full access</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us briefly what you'll use the AI features for..."
                  maxLength={500}
                  rows={2}
                  className="mb-2 w-full resize-none rounded-md border border-border/60 bg-background/80 px-2 py-1.5 text-xs outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
                />
                {error && <p className="mb-2 text-[10px] text-red-500">{error}</p>}
                <Button
                  onClick={handleRequest}
                  disabled={submitting}
                  size="sm"
                  className="h-7 w-full rounded-md bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500"
                >
                  {submitting ? 'Sending...' : 'Request Full Access'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
