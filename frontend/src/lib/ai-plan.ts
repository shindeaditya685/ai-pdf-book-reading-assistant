export const AI_PLANS = ['free', 'pro', 'beta', 'admin', 'founder'] as const
export type AIPlan = (typeof AI_PLANS)[number]

export const AI_FEATURES = ['summary', 'question', 'translation', 'quote_chat'] as const
export type AIFeature = (typeof AI_FEATURES)[number]

export interface AIUsage {
  date: string
  summaries: number
  questions: number
  translations: number
  /** Count of AI messages sent in the saved-quotes chat per day. */
  quoteChats: number
  minute: string
  minuteCount: number
}

export const DAILY_QUOTAS: Record<Exclude<AIPlan, 'pro' | 'beta' | 'admin' | 'founder'>, Record<AIFeature, number>> = {
  free: { summary: 5, question: 15, translation: 100, quote_chat: 50 },
}

export const PER_MINUTE_LIMITS: Record<Exclude<AIPlan, 'pro' | 'beta' | 'admin' | 'founder'>, number> = {
  free: 5,
}

export interface AIMinuteUsage {
  minute: string
  count: number
}

export const PLAN_LABELS: Record<AIPlan, string> = {
  free: 'Free',
  pro: 'Pro',
  beta: 'Beta Tester',
  admin: 'Admin',
  founder: 'Founder',
}

export const PLAN_DESCRIPTIONS: Record<AIPlan, string> = {
  free: 'Limited daily AI usage',
  pro: 'Unlimited AI access',
  beta: 'Unlimited AI access (beta program)',
  admin: 'Unlimited AI access (admin)',
  founder: 'Unlimited AI access (founder)',
}

export const PLAN_COLORS: Record<AIPlan, string> = {
  free: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  pro: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  beta: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  admin: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  founder: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export function isUnlimitedPlan(plan: AIPlan | null | undefined): boolean {
  return plan === 'pro' || plan === 'beta' || plan === 'admin' || plan === 'founder'
}

export function isAIPlan(value: unknown): value is AIPlan {
  return typeof value === 'string' && (AI_PLANS as readonly string[]).includes(value)
}

export function normalizeAIPlan(value: unknown): AIPlan {
  if (isAIPlan(value)) return value
  return 'free'
}

export function getDailyLimit(plan: AIPlan, feature: AIFeature): number {
  if (isUnlimitedPlan(plan)) return Number.POSITIVE_INFINITY
  return DAILY_QUOTAS.free[feature]
}

export function getPerMinuteLimit(plan: AIPlan): number {
  if (isUnlimitedPlan(plan)) return Number.POSITIVE_INFINITY
  return PER_MINUTE_LIMITS.free
}

export function currentMinuteUtc(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
}

export function todayUtc(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

export function nextMidnightUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0))
}

export function formatResetCountdown(): string {
  const ms = nextMidnightUtc().getTime() - Date.now()
  if (ms <= 0) return 'less than a minute'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function emptyUsage(): AIUsage {
  return { date: todayUtc(), summaries: 0, questions: 0, translations: 0, quoteChats: 0, minute: currentMinuteUtc(), minuteCount: 0 }
}

export function getUsageForFeature(usage: AIUsage | null | undefined, feature: AIFeature): number {
  if (!usage || usage.date !== todayUtc()) return 0
  if (feature === 'summary') return usage.summaries
  if (feature === 'question') return usage.questions
  if (feature === 'quote_chat') return usage.quoteChats ?? 0
  return usage.translations
}
