import { connectToDatabase } from './db'
import { ObjectId } from 'mongodb'
import {
  type AIFeature,
  type AIPlan,
  type AIUsage,
  currentMinuteUtc,
  emptyUsage,
  isUnlimitedPlan,
  getDailyLimit,
  getPerMinuteLimit,
  todayUtc,
  nextMidnightUtc,
} from './ai-plan'

export const AI_QUOTA_ENABLED = process.env.AI_QUOTA_ENABLED !== 'false'

export interface QuotaCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  plan: AIPlan
  isUnlimited: boolean
  resetAt: Date
  retryAfterSeconds?: number
  reason?: string
}

interface UserRecord {
  _id: ObjectId
  username: string
  isAdmin?: boolean
  plan?: AIPlan
  aiUsage?: AIUsage
}

async function getUserForQuota(userId: string): Promise<UserRecord | null> {
  const conn = await connectToDatabase()
  if (!conn) return null
  let objectId: ObjectId
  try { objectId = new ObjectId(userId) } catch { return null }
  const doc = await conn.db.collection('users').findOne(
    { _id: objectId },
    { projection: { username: 1, isAdmin: 1, plan: 1, aiUsage: 1 } }
  )
  return doc as UserRecord | null
}

function resolvePlan(user: UserRecord | null): AIPlan {
  if (!user) return 'free'
  if (user.isAdmin) return 'admin'
  return (user.plan as AIPlan) || 'free'
}

function freshUsageIfStale(usage: AIUsage | undefined): AIUsage {
  if (!usage || usage.date !== todayUtc()) return emptyUsage()
  return usage
}

export async function getQuotaStatus(userId: string): Promise<{
  plan: AIPlan
  isUnlimited: boolean
  usage: AIUsage
  limits: Record<AIFeature, number>
  resetAt: Date
  perMinuteLimit: number
} | null> {
  const user = await getUserForQuota(userId)
  if (!user) return null
  const plan = resolvePlan(user)
  const isUnlimited = isUnlimitedPlan(plan)
  const usage = freshUsageIfStale(user.aiUsage)
  return {
    plan,
    isUnlimited,
    usage,
    limits: {
      summary: isUnlimited ? Number.POSITIVE_INFINITY : getDailyLimit(plan, 'summary'),
      question: isUnlimited ? Number.POSITIVE_INFINITY : getDailyLimit(plan, 'question'),
      translation: isUnlimited ? Number.POSITIVE_INFINITY : getDailyLimit(plan, 'translation'),
    },
    resetAt: nextMidnightUtc(),
    perMinuteLimit: isUnlimited ? Number.POSITIVE_INFINITY : getPerMinuteLimit(plan),
  }
}

/**
 * Atomically check and consume one unit of `feature` from the user's daily quota.
 * Returns whether the call is allowed. Does NOT increment on failure.
 */
export async function consumeQuota(userId: string, feature: AIFeature): Promise<QuotaCheckResult> {
  const conn = await connectToDatabase()
  const resetAt = nextMidnightUtc()
  const fallback: QuotaCheckResult = {
    allowed: AI_QUOTA_ENABLED ? false : true,
    remaining: 0,
    limit: 0,
    plan: 'free',
    isUnlimited: false,
    resetAt,
    reason: AI_QUOTA_ENABLED ? 'Database unavailable' : undefined,
  }
  if (!conn) return fallback

  let objectId: ObjectId
  try { objectId = new ObjectId(userId) } catch { return fallback }

  const db = conn.db
  const today = todayUtc()
  const minute = currentMinuteUtc()
  const usageField = feature === 'summary' ? 'summaries' : feature === 'question' ? 'questions' : 'translations'

  // Fast-path: admins always allowed, no DB write needed
  const user = await db.collection('users').findOne(
    { _id: objectId },
    { projection: { isAdmin: 1, plan: 1, aiUsage: 1 } }
  )
  if (!user) {
    return { ...fallback, reason: 'User not found' }
  }

  const plan = resolvePlan(user as UserRecord)
  const isUnlimited = isUnlimitedPlan(plan)
  const limit = isUnlimited ? Number.POSITIVE_INFINITY : getDailyLimit(plan, feature)
  const perMinuteLimit = isUnlimited ? Number.POSITIVE_INFINITY : getPerMinuteLimit(plan)

  // Per-minute rate limit check
  const stored = user.aiUsage as AIUsage | undefined
  const storedMinute = stored?.minute
  const storedMinuteCount = storedMinute === minute ? (stored?.minuteCount ?? 0) : 0
  if (!isUnlimited && storedMinuteCount >= perMinuteLimit) {
    const nextMinute = new Date()
    nextMinute.setUTCSeconds(0, 0)
    nextMinute.setUTCMinutes(nextMinute.getUTCMinutes() + 1)
    return {
      allowed: false,
      remaining: 0,
      limit,
      plan,
      isUnlimited: false,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((nextMinute.getTime() - Date.now()) / 1000)),
      reason: `Rate limit: max ${perMinuteLimit} AI calls per minute.`,
    }
  }

  // Unlimited tier: no DB write, just allow
  if (isUnlimited) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, limit, plan, isUnlimited: true, resetAt }
  }

  if (!AI_QUOTA_ENABLED) {
    return { allowed: true, remaining: limit, limit, plan, isUnlimited: false, resetAt }
  }

  // Atomic check + increment using aggregation pipeline
  // 1. Reset if date is stale
  // 2. If count < limit, increment
  // 3. Otherwise, no-op
  // Also: reset minute counter if minute is stale, then increment
  const targetField: 'summaries' | 'questions' | 'translations' =
    feature === 'summary' ? 'summaries' : feature === 'question' ? 'questions' : 'translations'
  const incExpr = (field: 'summaries' | 'questions' | 'translations') =>
    field === targetField
      ? { $add: [{ $ifNull: [`$aiUsage.${field}`, 0] }, 1] }
      : { $ifNull: [`$aiUsage.${field}`, 0] }

  const minuteIncExpr = () => ({
    $cond: {
      if: { $eq: ['$aiUsage.minute', minute] },
      then: { $add: [{ $ifNull: ['$aiUsage.minuteCount', 0] }, 1] },
      else: 1,
    },
  })

  const updated = await db.collection('users').findOneAndUpdate(
    {
      _id: objectId,
      $or: [
        { [`aiUsage.${usageField}`]: { $lt: limit }, 'aiUsage.date': today },
        { aiUsage: { $exists: false } },
        { 'aiUsage.date': { $ne: today } },
      ],
    },
    [
      {
        $set: {
          aiUsage: {
            $cond: {
              if: { $eq: ['$aiUsage.date', today] },
              then: {
                date: today,
                summaries: incExpr('summaries'),
                questions: incExpr('questions'),
                translations: incExpr('translations'),
                minute: minute,
                minuteCount: minuteIncExpr(),
              },
              else: {
                date: today,
                summaries: feature === 'summary' ? 1 : 0,
                questions: feature === 'question' ? 1 : 0,
                translations: feature === 'translation' ? 1 : 0,
                minute: minute,
                minuteCount: 1,
              },
            },
          },
        },
      },
    ],
    { returnDocument: 'after' }
  )

  if (updated) {
    const used = (updated.aiUsage as AIUsage)?.[usageField] ?? 1
    return {
      allowed: true,
      remaining: Math.max(0, limit - used),
      limit,
      plan,
      isUnlimited: false,
      resetAt,
    }
  }

  // Quota exhausted — read current usage to return accurate remaining
  const current = await db.collection('users').findOne(
    { _id: objectId },
    { projection: { aiUsage: 1 } }
  )
  const usage = freshUsageIfStale(current?.aiUsage as AIUsage | undefined)
  const used = usage[usageField as keyof AIUsage] as number
  return {
    allowed: false,
    remaining: 0,
    limit,
    plan,
    isUnlimited: false,
    resetAt,
    reason: `Daily limit of ${limit} ${feature}s reached. Resets at midnight UTC.`,
  }
}

/**
 * Roll back a previously-consumed quota unit (use when the AI call fails after consuming).
 * Uses $inc with -1, guarded by $gte to avoid going negative.
 */
export async function refundQuota(userId: string, feature: AIFeature): Promise<void> {
  const conn = await connectToDatabase()
  if (!conn) return
  let objectId: ObjectId
  try { objectId = new ObjectId(userId) } catch { return }
  const usageField = feature === 'summary' ? 'summaries' : feature === 'question' ? 'questions' : 'translations'
  await conn.db.collection('users').updateOne(
    { _id: objectId, [`aiUsage.${usageField}`]: { $gt: 0 } },
    { $inc: { [`aiUsage.${usageField}`]: -1 } }
  )
}
