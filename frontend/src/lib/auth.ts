import crypto from 'crypto'
import { connectToDatabase } from './db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { AIPlan, AIUsage } from './ai-plan'

const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex')

export interface User {
  _id?: string
  username: string
  password: string
  isAdmin?: boolean
  plan?: AIPlan
  aiUsage?: AIUsage
  createdAt: Date
}

const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters`
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (PASSWORD_RULES.requireDigit && !/\d/.test(password)) {
    return 'Password must contain at least one digit'
  }
  return null
}

export async function createUser(username: string, password: string) {
  const conn = await connectToDatabase()
  if (!conn) throw new Error('DATABASE_UNAVAILABLE')

  const existing = await conn.db.collection('users').findOne({ username })
  if (existing) return null

  const hashed = await bcrypt.hash(password, 10)
  const result = await conn.db.collection('users').insertOne({
    username,
    password: hashed,
    isAdmin: false,
    plan: 'free',
    createdAt: new Date(),
  })
  return { id: result.insertedId.toString(), username, isAdmin: false, plan: 'free' as AIPlan }
}

export async function authenticateUser(username: string, password: string) {
  const conn = await connectToDatabase()
  if (!conn) throw new Error('DATABASE_UNAVAILABLE')

  const user = await conn.db.collection('users').findOne({ username })
  if (!user) return null

  const match = await bcrypt.compare(password, user.password)
  if (!match) return null

  return {
    id: user._id.toString(),
    username: user.username,
    isAdmin: !!user.isAdmin,
    plan: (user.plan as AIPlan) || 'free',
  }
}

export function generateToken(user: { id: string; username: string; isAdmin?: boolean }) {
  return jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.isAdmin }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; username: string; isAdmin: boolean }
  } catch {
    return null
  }
}

export async function getUserFromDb(payload: { id: string; username: string }) {
  const conn = await connectToDatabase()
  if (!conn) return null

  const { ObjectId } = await import('mongodb')
  let objectId
  try { objectId = new ObjectId(payload.id) } catch { return null }

  const user = await conn.db.collection('users').findOne(
    { _id: objectId },
    { projection: { password: 0 } }
  )
  if (!user) return null

  return {
    id: user._id.toString(),
    username: user.username,
    isAdmin: !!user.isAdmin,
    plan: (user.plan as AIPlan) || 'free',
  }
}

export function getUserFromRequest(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}

export { PASSWORD_RULES }
