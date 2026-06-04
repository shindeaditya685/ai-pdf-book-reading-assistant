import { NextResponse } from 'next/server'
import { authenticateUser, generateToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateCheck = checkRateLimit(`login:${ip}`, 5, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil(rateCheck.resetIn / 1000)}s` },
        { status: 429 }
      )
    }

    const { username: rawUsername, password } = await request.json()
    const username = typeof rawUsername === 'string' ? rawUsername.trim() : ''
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const user = await authenticateUser(username, password)
    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const token = generateToken(user)
    return NextResponse.json({ token, user })
  } catch (error) {
    if (error instanceof Error && error.message === 'DATABASE_UNAVAILABLE') {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
