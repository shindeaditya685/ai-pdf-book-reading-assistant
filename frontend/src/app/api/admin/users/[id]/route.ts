import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { ObjectId } from 'mongodb'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    let objectId: ObjectId
    try { objectId = new ObjectId(id) } catch { return NextResponse.json({ error: 'Invalid id' }, { status: 400 }) }

    const conn = await connectToDatabase()
    if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

    const db = conn.db
    const user = await db.collection('users').findOne({ _id: objectId })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (user.username === admin.username) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    const username = user.username
    await db.collection('users').deleteOne({ _id: objectId })
    await db.collection('pdfs').deleteMany({ username })
    await db.collection('bookmarks').deleteMany({ username })
    await db.collection('wordHistory').deleteMany({ username })
    await db.collection('history').deleteMany({ username })
    await db.collection('annotations').deleteMany({ username })

    return NextResponse.json({ success: true, username })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
