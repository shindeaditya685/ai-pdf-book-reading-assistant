/**
 * Backfill script: ensures every user has a `plan` field (defaults to 'free').
 * Run with: npx tsx scripts/backfill-plans.ts
 * (or: node --experimental-strip-types scripts/backfill-plans.ts on Node 22+)
 */
import { connectToDatabase } from '../src/lib/db'
import { isAIPlan } from '../src/lib/ai-plan'

async function main() {
  const conn = await connectToDatabase()
  if (!conn) {
    console.error('[backfill] Database unavailable, aborting.')
    process.exit(1)
  }
  const users = conn.db.collection('users')

  const cursor = users.find({}, { projection: { username: 1, plan: 1, isAdmin: 1 } })
  let updated = 0
  let skipped = 0
  let total = 0

  for await (const user of cursor) {
    total += 1
    const desiredPlan = user.isAdmin ? 'admin' : isAIPlan(user.plan) ? user.plan : 'free'
    if (user.plan === desiredPlan) {
      skipped += 1
      continue
    }
    await users.updateOne(
      { _id: user._id },
      { $set: { plan: desiredPlan, updatedAt: new Date() } }
    )
    updated += 1
    console.log(`  ✓ ${user.username} -> ${desiredPlan}`)
  }

  console.log(`\n[backfill] Done. Total: ${total}, Updated: ${updated}, Skipped: ${skipped}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[backfill] Failed:', err)
  process.exit(1)
})
