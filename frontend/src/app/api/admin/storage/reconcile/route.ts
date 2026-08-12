import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectToDatabase } from '@/lib/db'
import { isStorageConfigured, listStorageKeys } from '@/lib/storage'

// GET  — compare MongoDB `pdfs` docs against objects actually in object storage.
// POST — delete the Mongo metadata docs that no longer have an object in storage
//        (e.g. PDFs removed directly in the Supabase dashboard).
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Object storage is not configured' }, { status: 503 })
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const [keys, docs] = await Promise.all([
      listStorageKeys(),
      conn.db
        .collection('pdfs')
        .find({ r2Key: { $exists: true } }, { projection: { fileName: 1, username: 1, r2Key: 1 } })
        .toArray(),
    ])

    const storage = new Set(keys)
    const orphans = docs
      .filter((d) => !storage.has(d.r2Key as string))
      .map((d) => ({ username: d.username, fileName: d.fileName, r2Key: d.r2Key }))

    const totalDocs = await conn.db.collection('pdfs').countDocuments({})
    const inlineDocs = await conn.db.collection('pdfs').countDocuments({
      $or: [{ content: { $exists: true } }, { gridFsId: { $exists: true } }],
    })

    return NextResponse.json({
      totalObjects: keys.length,
      totalDocs,
      inlineDocs,
      orphanCount: orphans.length,
      orphans,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'Object storage is not configured' }, { status: 503 })
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    const [keys, docs] = await Promise.all([
      listStorageKeys(),
      conn.db
        .collection('pdfs')
        .find({ r2Key: { $exists: true } }, { projection: { r2Key: 1 } })
        .toArray(),
    ])

    const storage = new Set(keys)
    const orphanKeys = docs.map((d) => d.r2Key as string).filter((k) => !storage.has(k))
    if (orphanKeys.length === 0) {
      return NextResponse.json({ deleted: 0 })
    }

    const result = await conn.db.collection('pdfs').deleteMany({ r2Key: { $in: orphanKeys } })
    return NextResponse.json({ deleted: result.deletedCount })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
