import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { logAudit } from '@/lib/audit'
import { AI_PLANS, type AIPlan } from '@/lib/ai-plan'

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { userIds, plan } = body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds must be a non-empty array' }, { status: 400 })
    }
    if (!AI_PLANS.includes(plan)) {
      return NextResponse.json({ error: `Invalid plan. Must be one of: ${AI_PLANS.join(', ')}` }, { status: 400 })
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const objectIds = userIds.map((id: string) => {
      try { return new ObjectId(id) } catch {
        throw new Error(`Invalid id: ${id}`)
      }
    })

    const result = await conn.db.collection('users').updateMany(
      { _id: { $in: objectIds } },
      { $set: { plan } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'No matching users found' }, { status: 404 })
    }

    await logAudit({
      adminUsername: admin.username,
      action: 'bulk_plan_change',
      targetUsername: 'system',
      details: `Changed ${result.modifiedCount} users to plan "${plan}"`,
    })

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    })
  } catch (err: any) {
    if (err.message?.startsWith('Invalid id:')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
