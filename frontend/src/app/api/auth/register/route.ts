import { NextResponse } from 'next/server'
import { createUser, generateToken, validatePassword, validateUsername } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateCheck = checkRateLimit(`register:${ip}`, 3, 60000)
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
    const usernameError = validateUsername(username)
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 })
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const user = await createUser(username, password)
    if (!user) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
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
