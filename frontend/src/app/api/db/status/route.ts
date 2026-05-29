import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'

export async function GET() {
  const conn = await connectToDatabase()
  if (!conn) {
    return NextResponse.json({ connected: false, error: 'Could not connect to MongoDB' })
  }

  try {
    const admin = conn.db.admin()
    const dbName = conn.db.databaseName
    const collections = await conn.db.listCollections().toArray()
    const stats = await admin.serverStatus()

    return NextResponse.json({
      connected: true,
      databaseName: dbName,
      collections: collections.map((c) => c.name),
      serverVersion: stats.version,
      ok: true,
    })
  } catch (e: any) {
    return NextResponse.json({
      connected: true,
      databaseName: conn.db.databaseName,
      error: e.message,
    })
  }
}
