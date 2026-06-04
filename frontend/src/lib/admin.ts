import { ObjectId } from 'mongodb'
import { verifyToken } from './auth'
import { connectToDatabase } from './db'

export async function requireAdmin(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const payload = verifyToken(auth.slice(7))
  if (!payload?.isAdmin) return null

  const conn = await connectToDatabase()
  if (!conn) return null

  let objectId: ObjectId
  try { objectId = new ObjectId(payload.id) } catch { return null }

  const user = await conn.db.collection('users').findOne({ _id: objectId })
  if (!user?.isAdmin) return null

  return payload
}
