import { MongoClient, type Db } from 'mongodb'

const uri = process.env.DATABASE_URL || ''

const globalForMongo = globalThis as unknown as {
  _mongoClient?: MongoClient
  _mongoDb?: Db
  _mongoPromise?: Promise<{ client: MongoClient; db: Db } | null>
}

async function createConnection(): Promise<{ client: MongoClient; db: Db } | null> {
  if (!uri) {
    console.warn('[DB] DATABASE_URL is not set')
    return null
  }
  try {
    console.log('[DB] Connecting to MongoDB...')
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 60000,
    })
    await client.connect()
    const db = client.db()
    console.log(`[DB] Connected to database: ${db.databaseName}`)
    return { client, db }
  } catch (err: any) {
    console.error(`[DB] Connection failed: ${err?.message || err}`)
    return null
  }
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db } | null> {
  if (globalForMongo._mongoClient && globalForMongo._mongoDb) {
    return { client: globalForMongo._mongoClient, db: globalForMongo._mongoDb }
  }

  if (!globalForMongo._mongoPromise) {
    globalForMongo._mongoPromise = createConnection().then((conn) => {
      if (conn) {
        globalForMongo._mongoClient = conn.client
        globalForMongo._mongoDb = conn.db
      } else {
        globalForMongo._mongoPromise = undefined
      }
      return conn
    })
  }
  return globalForMongo._mongoPromise
}
