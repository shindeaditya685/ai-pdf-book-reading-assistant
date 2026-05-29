import { MongoClient, type Db } from 'mongodb'

const uri = process.env.DATABASE_URL || ''
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db } | null> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  if (!uri) {
    console.warn('[DB] DATABASE_URL is not set')
    return null
  }

  try {
    console.log('[DB] Connecting to MongoDB...')
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    })
    await client.connect()

    const db = client.db()
    const dbName = db.databaseName
    console.log(`[DB] Connected to database: ${dbName}`)

    cachedClient = client
    cachedDb = db

    return { client, db }
  } catch (err: any) {
    console.error(`[DB] Connection failed: ${err?.message || err}`)
    return null
  }
}
