'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import {
  PLAN_LABELS,
  type AIFeature,
  type AIPlan,
  type AIUsage,
  getUsageForFeature,
  normalizeAIPlan,
} from '@/lib/ai-plan'

export interface QuotaState {
  plan: AIPlan
  isUnlimited: boolean
  usage: AIUsage
  limits: Record<AIFeature, number | null>
  perMinuteLimit: number | null
  resetAt: string
  loading: boolean
  error: string | null
}

const EMPTY: QuotaState = {
  plan: 'free',
  isUnlimited: false,
  usage: { date: '', summaries: 0, questions: 0, translations: 0, quoteChats: 0, ielts: 0, bulkLookups: 0, minute: '', minuteCount: 0 },
  limits: { summary: 0, question: 0, translation: 0, quote_chat: 0, ielts: 0, bulk_lookup: 0 },
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
      const isUnlimited = !!data.isUnlimited
      const plan = normalizeAIPlan(data.plan)
      setState({
        plan,
        isUnlimited,
        usage: data.usage || EMPTY.usage,
        limits: {
          summary: isUnlimited ? null : Number(data.limits?.summary) || 0,
          question: isUnlimited ? null : Number(data.limits?.question) || 0,
          translation: isUnlimited ? null : Number(data.limits?.translation) || 0,
          quote_chat: isUnlimited ? null : Number(data.limits?.quote_chat) || 0,
          ielts: isUnlimited ? null : Number(data.limits?.ielts) || 0,
          bulk_lookup: isUnlimited ? null : Number(data.limits?.bulk_lookup) || 0,
        },
        perMinuteLimit: isUnlimited ? null : Number(data.perMinuteLimit) || 0,
        resetAt: data.resetAt || '',
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
  const limit = state.limits[feature]
  const used = getUsageForFeature(state.usage, feature)
  if (typeof limit !== 'number') return 0
  return Math.max(0, limit - used)
}

export function quotaTotals(state: Pick<QuotaState, 'usage' | 'limits' | 'isUnlimited'>) {
  if (state.isUnlimited) return { used: 0, limit: Number.POSITIVE_INFINITY, remaining: Number.POSITIVE_INFINITY }
  const features: AIFeature[] = ['summary', 'question', 'translation']
  const limit = features.reduce((sum, feature) => sum + (state.limits[feature] || 0), 0)
  const used = features.reduce((sum, feature) => sum + getUsageForFeature(state.usage, feature), 0)
  return { used, limit, remaining: Math.max(0, limit - used) }
}

export function quotaBadgeLabel(state: Pick<QuotaState, 'plan'>): string {
  return PLAN_LABELS[state.plan]
}
