import crypto from 'crypto'
import { connectToDatabase } from './db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { normalizeAIPlan, type AIPlan, type AIUsage } from './ai-plan'

/**
 * JWT secret.
 *
 * In production we fail fast if JWT_SECRET is missing — otherwise every
 * serverless instance would mint its own random secret, silently
 * invalidating all tokens on cold starts and making behavior
 * non-deterministic. In dev we fall back to an ephemeral secret with a
 * loud warning so local development still works without env setup.
 */
function resolveJwtSecret(): string {
  const env = process.env.JWT_SECRET
  if (env) return env
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production')
  }
  console.warn('[auth] JWT_SECRET not set — using ephemeral dev secret. Set JWT_SECRET in production.')
  return crypto.randomBytes(64).toString('hex')
}

const JWT_SECRET = resolveJwtSecret()

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
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: false,
}

const USERNAME_RULES = {
  minLength: 3,
  maxLength: 30,
  /** Letters, numbers, periods, underscores — like Instagram. */
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9._]*[a-zA-Z0-9]$/,
  consecutiveDots: /\.{2,}/,
  consecutiveUnderscores: /_{2,}/,
  consecutiveMix: /[._]{2,}/,
}

function validateUsername(username: string): string | null {
  const u = username.trim()
  if (u.length < USERNAME_RULES.minLength) {
    return `Username must be at least ${USERNAME_RULES.minLength} characters`
  }
  if (u.length > USERNAME_RULES.maxLength) {
    return `Username must be at most ${USERNAME_RULES.maxLength} characters`
  }
  if (/\s/.test(u)) {
    return 'Username must not contain spaces'
  }
  if (u.startsWith('.') || u.startsWith('_') || u.endsWith('.') || u.endsWith('_')) {
    return 'Username cannot start or end with a dot or underscore'
  }
  if (USERNAME_RULES.consecutiveDots.test(u) || USERNAME_RULES.consecutiveUnderscores.test(u)) {
    return 'Username cannot have consecutive dots or underscores'
  }
  if (!USERNAME_RULES.pattern.test(u)) {
    return 'Use letters, numbers, dots, and underscores only'
  }
  return null
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
    plan: normalizeAIPlan(user.plan),
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
    plan: normalizeAIPlan(user.plan),
  }
}

export function getUserFromRequest(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}

export { PASSWORD_RULES, USERNAME_RULES, validateUsername }
