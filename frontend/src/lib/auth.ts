import { connectToDatabase } from './db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export interface User {
  _id?: string
  username: string
  password: string
  createdAt: Date
}

export async function createUser(username: string, password: string) {
  const conn = await connectToDatabase()
  if (!conn) return null

  const existing = await conn.db.collection('users').findOne({ username })
  if (existing) return null

  const hashed = await bcrypt.hash(password, 10)
  const result = await conn.db.collection('users').insertOne({
    username,
    password: hashed,
    createdAt: new Date(),
  })
  return { id: result.insertedId.toString(), username }
}

export async function authenticateUser(username: string, password: string) {
  const conn = await connectToDatabase()
  if (!conn) return null

  const user = await conn.db.collection('users').findOne({ username })
  if (!user) return null

  const match = await bcrypt.compare(password, user.password)
  if (!match) return null

  return { id: user._id.toString(), username: user.username }
}

export function generateToken(user: { id: string; username: string }) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; username: string }
  } catch {
    return null
  }
}

export function getUserFromRequest(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}
