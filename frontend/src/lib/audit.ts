import { connectToDatabase } from '@/lib/db'

export type AuditAction =
  | 'delete_user'
  | 'promote_admin'
  | 'revoke_admin'
  | 'change_plan'
  | 'grant_access'
  | 'dismiss_access'

export async function logAudit(opts: {
  adminUsername: string
  action: AuditAction
  targetUsername: string
  details?: string
}) {
  const conn = await connectToDatabase()
  if (!conn) return
  try {
    await conn.db.collection('auditLog').insertOne({
      adminUsername: opts.adminUsername,
      action: opts.action,
      targetUsername: opts.targetUsername,
      details: opts.details || '',
      createdAt: new Date(),
    })
  } catch {
    // audit logging is best-effort
  }
}
