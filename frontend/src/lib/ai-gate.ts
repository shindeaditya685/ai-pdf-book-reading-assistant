import { NextResponse } from 'next/server'
import { consumeQuota, refundQuota, type QuotaCheckResult } from './ai-quota-server'
import { getUserFromRequest } from './auth'
import type { AIFeature } from './ai-plan'

export type AiGateResult =
  | { kind: 'allow'; userId: string; quota: QuotaCheckResult }
  | { kind: 'deny'; response: NextResponse }
  | { kind: 'anon'; response: NextResponse }

/**
 * Standard guard for AI endpoints:
 *  - requires an authenticated user
 *  - consumes one unit of `feature` quota
 *  - returns either an allow-result with the userId (for the caller to run the AI call)
 *    or a deny-response that should be returned to the client as-is.
 *
 * On 5xx from the downstream AI call, call `refundIfFailed(userId, feature)` to give the credit back.
 */
export async function gateAiRequest(
  request: Request,
  feature: AIFeature
): Promise<AiGateResult> {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return {
      kind: 'anon',
      response: NextResponse.json(
        { error: 'You must be signed in to use AI features.' },
        { status: 401 }
      ),
    }
  }

  const quota = await consumeQuota(payload.id, feature)
  if (!quota.allowed) {
    const headers: Record<string, string> = {}
    if (quota.retryAfterSeconds) {
      headers['Retry-After'] = String(quota.retryAfterSeconds)
    }
    return {
      kind: 'deny',
      response: NextResponse.json(
        {
          error: quota.reason || 'Daily AI limit reached.',
          quota: {
            remaining: quota.remaining,
            limit: quota.limit,
            plan: quota.plan,
            resetAt: quota.resetAt.toISOString(),
            retryAfterSeconds: quota.retryAfterSeconds,
          },
        },
        { status: 429, headers }
      ),
    }
  }

  return { kind: 'allow', userId: payload.id, quota }
}

export async function refundIfFailed(userId: string, feature: AIFeature): Promise<void> {
  await refundQuota(userId, feature)
}
