import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { migratePdfsToStorage } from '@/lib/migrate-pdfs'

/**
 * Admin-only: moves any remaining PDF binaries (inline base64 + GridFS) out of
 * MongoDB into S3-compatible object storage. Run it once after deploying with
 * the S3_* env variables, then re-run until `failed` is 0 — it is idempotent.
 */
export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const result = await migratePdfsToStorage(conn)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Migration failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const remaining = await conn.db
    .collection('pdfs')
    .countDocuments({ $or: [{ content: { $exists: true } }, { gridFsId: { $exists: true } }] })
  return NextResponse.json({ remaining })
}