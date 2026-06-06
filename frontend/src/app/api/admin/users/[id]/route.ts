import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { isAIPlan, type AIPlan } from '@/lib/ai-plan'

const ALLOWED_PLANS: AIPlan[] = ['free', 'pro', 'beta', 'admin', 'founder']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 })

    const body = await request.json()
    const plan = body?.plan
    if (!isAIPlan(plan) || !ALLOWED_PLANS.includes(plan as AIPlan)) {
      return NextResponse.json({ error: 'Invalid plan. Must be one of: ' + ALLOWED_PLANS.join(', ') }, { status: 400 })
    }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch { return NextResponse.json({ error: 'Invalid userId' }, { status: 400 }) }

    const user = await conn.db.collection('users').findOne({ _id: objectId }, { projection: { username: 1, isAdmin: 1 } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (user.username === admin.username && plan !== 'admin') {
      return NextResponse.json({ error: 'Cannot change your own plan away from admin' }, { status: 400 })
    }

    if (plan === 'admin' && !user.isAdmin) {
      return NextResponse.json({ error: 'Use the Make Admin action to grant admin access' }, { status: 400 })
    }

    await conn.db.collection('users').updateOne(
      { _id: objectId },
      { $set: { plan: plan as AIPlan, updatedAt: new Date() } }
    )

    // If the user had a pending access request, mark it granted
    await conn.db.collection('accessRequests').updateOne(
      { userId: objectId, status: 'pending' },
      { $set: { status: 'granted', grantedAt: new Date(), grantedPlan: plan, grantedBy: admin.username } }
    )

    return NextResponse.json({ success: true, username: user.username, plan })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch { return NextResponse.json({ error: 'Invalid userId' }, { status: 400 }) }

    const user = await conn.db.collection('users').findOne({ _id: objectId }, { projection: { username: 1 } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (user.username === admin.username) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    await conn.db.collection('users').deleteOne({ _id: objectId })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
