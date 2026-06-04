import { NextResponse } from 'next/server'
import { verifyToken, getUserFromDb } from '@/lib/auth'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = verifyToken(auth.slice(7))
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Re-fetch from DB to get current isAdmin status (in case user was promoted after token was issued)
  const user = await getUserFromDb(payload)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  return NextResponse.json({ user })
}
