'use client'

import { Sparkles, Crown, Rocket, FlaskConical } from 'lucide-react'
import { PLAN_LABELS, type AIPlan } from '@/lib/ai-plan'
import { quotaTotals, type QuotaState } from '@/hooks/use-ai-quota'

interface Props {
  state: QuotaState
  onClick: () => void
}

function planIcon(plan: AIPlan) {
  if (plan === 'founder') return <Crown className="h-3 w-3" />
  if (plan === 'pro') return <Rocket className="h-3 w-3" />
  if (plan === 'beta') return <FlaskConical className="h-3 w-3" />
  if (plan === 'admin') return <Sparkles className="h-3 w-3" />
  return <Sparkles className="h-3 w-3" />
}

function planBadgeClass(plan: AIPlan) {
  if (plan === 'founder') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (plan === 'pro') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
  if (plan === 'beta') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (plan === 'admin') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
}

export function AIQuotaBadge({ state, onClick }: Props) {
  if (state.loading) return null

  const totals = quotaTotals(state)
  const isOut = !state.isUnlimited && totals.remaining === 0
  const isLow = !state.isUnlimited && !isOut && totals.remaining <= 5

  const label = state.error
    ? 'AI status'
    : state.isUnlimited
    ? PLAN_LABELS[state.plan]
    : `${totals.remaining}/${totals.limit}`

  return (
    <button
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-semibold transition-opacity hover:opacity-80 ${planBadgeClass(state.plan)} ${
        isOut ? 'ring-1 ring-red-500/50' : isLow ? 'ring-1 ring-amber-500/50' : ''
      }`}
      title={state.error ? 'AI quota status unavailable' : 'View AI quota and plan'}
    >
      {planIcon(state.plan)}
      <span className="tabular-nums">{label}</span>
    </button>
  )
}
