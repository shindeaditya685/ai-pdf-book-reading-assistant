'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import {
  PLAN_LABELS,
  type AIFeature,
  type AIPlan,
  type AIUsage,
} from '@/lib/ai-plan'

export interface QuotaState {
  plan: AIPlan
  isUnlimited: boolean
  usage: AIUsage
  limits: Record<AIFeature, number>
  perMinuteLimit: number
  resetAt: string
  loading: boolean
  error: string | null
}

const EMPTY: QuotaState = {
  plan: 'free',
  isUnlimited: false,
  usage: { date: '', summaries: 0, questions: 0, translations: 0, minute: '', minuteCount: 0 },
  limits: { summary: 0, question: 0, translation: 0 },
  perMinuteLimit: 0,
  resetAt: '',
  loading: true,
  error: null,
}

export function useAIQuota(enabled = true) {
  const [state, setState] = useState<QuotaState>(EMPTY)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    try {
      const res = await authFetch('/api/ai/quota')
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, error: `HTTP ${res.status}` }))
        return
      }
      const data = await res.json()
      setState({
        plan: data.plan,
        isUnlimited: !!data.isUnlimited,
        usage: data.usage,
        limits: data.limits,
        perMinuteLimit: data.perMinuteLimit ?? 0,
        resetAt: data.resetAt,
        loading: false,
        error: null,
      })
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load quota',
      }))
    }
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...state, refresh }
}

export function remainingFor(state: Pick<QuotaState, 'usage' | 'limits' | 'isUnlimited'>, feature: AIFeature): number {
  if (state.isUnlimited) return Number.POSITIVE_INFINITY
  const limit = state.limits[feature] ?? 0
  const used =
    feature === 'summary' ? state.usage.summaries : feature === 'question' ? state.usage.questions : state.usage.translations
  return Math.max(0, limit - used)
}

export function quotaBadgeLabel(state: Pick<QuotaState, 'plan' | 'isUnlimited' | 'usage' | 'limits'>): string {
  if (state.isUnlimited) return PLAN_LABELS[state.plan]
  return PLAN_LABELS[state.plan]
}
