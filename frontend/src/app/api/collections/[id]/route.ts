import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ObjectId } from 'mongodb'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch {
      return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
    }

    const collection = await conn.db.collection('collections').findOne({ _id: objectId, username: user.username })
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ collection })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch collection' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false }, { status: 503 })

  try {
    const { id } = await params
    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch {
      return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
    }

    const result = await conn.db.collection('collections').deleteOne({ _id: objectId, username: user.username })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
