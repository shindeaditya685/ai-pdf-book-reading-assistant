import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'

const STREAK_MILESTONES = [
  { days: 7, rewardDays: 3, label: '7-day streak' },
  { days: 14, rewardDays: 7, label: '14-day streak' },
  { days: 30, rewardDays: 14, label: '30-day streak' },
  { days: 60, rewardDays: 30, label: '60-day streak' },
] as const

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ rewards: [], newReward: null })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ rewards: [], newReward: null })

    // Get current streak
    const statsRes = await conn.db.collection('readingStats').findOne(
      { username: user.username },
      { sort: { date: -1 } }
    )
    if (!statsRes) return NextResponse.json({ rewards: [], newReward: null })

    const streak = statsRes.streak || 0
    if (streak < 7) return NextResponse.json({ rewards: [], newReward: null })

    // Check which milestones have already been rewarded for this user
    const existingRewards = await conn.db
      .collection('grants')
      .find({
        username: user.username,
        grantedBy: 'system',
        type: 'streak_reward',
      })
      .project({ streakMilestone: 1 })
      .toArray()

    const rewardedMilestones = new Set(existingRewards.map((r: any) => r.streakMilestone))

    // Find new milestones to reward
    let newReward: any = null
    for (const milestone of STREAK_MILESTONES) {
      if (streak >= milestone.days && !rewardedMilestones.has(milestone.days)) {
        const now = new Date()
        const expiresAt = new Date(now)
        expiresAt.setDate(expiresAt.getDate() + milestone.rewardDays)

        const grant = {
          username: user.username,
          plan: 'pro',
          grantedBy: 'system',
          type: 'streak_reward',
          streakMilestone: milestone.days,
          durationDays: milestone.rewardDays,
          grantedAt: now,
          expiresAt,
          reason: milestone.label,
          active: true,
        }

        await conn.db.collection('grants').insertOne(grant)

        // Update user's plan
        await conn.db.collection('users').updateOne(
          { username: user.username },
          { $set: { plan: 'pro', planExpiresAt: expiresAt } }
        )

        newReward = { ...grant, _id: undefined }
        break // Only grant one reward at a time
      }
    }

    // Get all active rewards
    const rewards = await conn.db
      .collection('grants')
      .find({
        username: user.username,
        type: 'streak_reward',
        active: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      })
      .sort({ grantedAt: -1 })
      .toArray()

    return NextResponse.json({ rewards, newReward, streak })
  } catch {
    return NextResponse.json({ rewards: [], newReward: null })
  }
}
