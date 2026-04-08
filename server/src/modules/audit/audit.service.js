import db from '../../config/database.js';

/**
 * Audit log for all sensitive operations.
 * Records who did what, when, and the before/after state.
 */
export async function logAudit({
  tenantId = null,
  userId = null,
  action,
  entity,
  entityId = null,
  oldValue = null,
  newValue = null,
  ipAddress = null,
  requestId = null,
}) {
  try {
    await db('audit_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      action,
      entity,
      entity_id: entityId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: ipAddress,
      request_id: requestId,
    });
  } catch (err) {
    // Audit log failure should never break the main operation
    // But we log it so ops knows
    console.error('Audit log write failed:', err.message);
  }
}

export async function getAuditLogs(tenantId, { entity, userId, from, to, page = 1, limit = 50 } = {}) {
  let query = db('audit_logs');
  if (tenantId) query = query.where({ tenant_id: tenantId });
  if (entity) query = query.where({ entity });
  if (userId) query = query.where({ user_id: userId });
  if (from) query = query.where('created_at', '>=', from);
  if (to) query = query.where('created_at', '<=', to);

  const [{ count }] = await query.clone().count();
  const logs = await query
    .orderBy('created_at', 'desc')
    .limit(Math.min(limit, 100))
    .offset((page - 1) * limit);

  return { data: logs, meta: { total: parseInt(count, 10), page, limit } };
}
