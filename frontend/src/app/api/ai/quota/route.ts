import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import {
  type AIPlan,
  type AIUsage,
  emptyUsage,
  getDailyLimit,
  getPerMinuteLimit,
  isUnlimitedPlan,
  nextMidnightUtc,
  normalizeAIPlan,
  todayUtc,
} from '@/lib/ai-plan'

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conn = await connectToDatabase()
    if (!conn) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    let objectId: ObjectId
    try { objectId = new ObjectId(user.id) } catch {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const doc = await conn.db.collection('users').findOne(
      { _id: objectId },
      { projection: { isAdmin: 1, plan: 1, aiUsage: 1, planExpiresAt: 1 } }
    )

    let plan: AIPlan = normalizeAIPlan(doc?.plan)

    // Check for active grants if user's plan has expired
    if (doc?.planExpiresAt && new Date(doc.planExpiresAt) <= new Date()) {
      // Plan expired — look for an active grant
      const activeGrant = await conn.db.collection('grants').findOne({
        username: user.username,
        active: true,
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: null },
        ],
      })
      if (activeGrant) {
        plan = normalizeAIPlan(activeGrant.plan)
      } else {
        plan = 'free'
        // Fall back to free
        await conn.db.collection('users').updateOne(
          { _id: objectId },
          { $set: { plan: 'free', planExpiresAt: null } }
        )
      }
    }
    const isUnlimited = isUnlimitedPlan(plan)
    const stored = doc?.aiUsage as AIUsage | undefined
    const usage: AIUsage = !stored || stored.date !== todayUtc() ? emptyUsage() : stored

    return NextResponse.json({
      plan,
      isUnlimited,
      usage,
      limits: {
        summary: isUnlimited ? null : getDailyLimit(plan, 'summary'),
        question: isUnlimited ? null : getDailyLimit(plan, 'question'),
        translation: isUnlimited ? null : getDailyLimit(plan, 'translation'),
        quote_chat: isUnlimited ? null : getDailyLimit(plan, 'quote_chat'),
        ielts: isUnlimited ? null : getDailyLimit(plan, 'ielts'),
      },
      perMinuteLimit: isUnlimited ? null : getPerMinuteLimit(plan),
      resetAt: nextMidnightUtc().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
