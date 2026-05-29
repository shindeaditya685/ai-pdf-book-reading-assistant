import { NextResponse } from 'next/server'
import { createUser, generateToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }
    if (username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const user = await createUser(username, password)
    if (!user) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    const token = generateToken(user)
    return NextResponse.json({ token, user })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
