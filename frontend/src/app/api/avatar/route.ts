import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { avatarImage } = await request.json()
  if (!avatarImage) {
    return NextResponse.json({ error: 'avatarImage is required' }, { status: 400 })
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    await conn.db.collection('users').updateOne(
      { username: user.username },
      { $set: { avatarImage } }
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save avatar' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ avatarImage: null })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ avatarImage: null })

  try {
    const profile = await conn.db.collection('users').findOne(
      { username: user.username },
      { projection: { avatarImage: 1 } }
    )
    return NextResponse.json({ avatarImage: profile?.avatarImage || null })
  } catch {
    return NextResponse.json({ avatarImage: null })
  }
}
