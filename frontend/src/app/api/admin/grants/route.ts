import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { isAIPlan, PLAN_LABELS, type AIPlan } from '@/lib/ai-plan'
import { logAudit } from '@/lib/audit'

const GRANTABLE_PLANS: AIPlan[] = ['pro', 'beta', 'founder']

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const grants = await conn.db
      .collection('grants')
      .find()
      .sort({ grantedAt: -1 })
      .toArray()

    return NextResponse.json({ grants })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { username, plan, durationDays } = body

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 })
    }
    if (!isAIPlan(plan) || !GRANTABLE_PLANS.includes(plan as AIPlan)) {
      return NextResponse.json({ error: 'Invalid plan. Must be one of: ' + GRANTABLE_PLANS.join(', ') }, { status: 400 })
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const user = await conn.db.collection('users').findOne(
      { username },
      { projection: { username: 1 } }
    )
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const now = new Date()
    let expiresAt: Date | null = null
    if (durationDays && typeof durationDays === 'number' && durationDays > 0) {
      expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + durationDays)
    }

    const grant = {
      username,
      plan: plan as AIPlan,
      grantedBy: admin.username,
      durationDays: durationDays || 0,
      grantedAt: now,
      expiresAt,
      reason: body.reason || `Granted by ${admin.username}`,
      active: true,
    }

    const result = await conn.db.collection('grants').insertOne(grant)

    // Also update the user's plan so quota check picks it up immediately
    await conn.db.collection('users').updateOne(
      { username },
      { $set: { plan: plan as AIPlan, updatedAt: now, planExpiresAt: expiresAt } }
    )

    await logAudit({
      adminUsername: admin.username,
      action: 'change_plan',
      targetUsername: username,
      details: `${PLAN_LABELS[plan as AIPlan]} granted${durationDays ? ` for ${durationDays} days` : ' (permanent)'}`,
    })

    return NextResponse.json({ grant: { ...grant, _id: result.insertedId } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
