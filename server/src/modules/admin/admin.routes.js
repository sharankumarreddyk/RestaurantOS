import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { updateUserSchema } from './admin.schema.js';
import { logAudit } from '../audit/audit.service.js';
import db from '../../config/database.js';

export default async function adminRoutes(fastify) {
  const superAuth = [authenticate, authorize(['super_admin'])];

  // List users for a tenant (owner/manager)
  fastify.get('/users', {
    preHandler: [authenticate, tenantContext, authorize(['super_admin', 'owner', 'manager'])],
  }, async (request) => {
    const tenantId = request.tenantId || request.headers['x-tenant-id'];
    if (!tenantId) return { data: [] };

    const users = await db('users')
      .where({ tenant_id: tenantId })
      .whereNull('deleted_at')
      .select('id', 'name', 'email', 'phone', 'role', 'is_active', 'last_login', 'created_at')
      .orderBy('created_at', 'desc');

    return { data: users };
  });

  // Update user — validated
  fastify.put('/users/:id', {
    preHandler: [
      authenticate, tenantContext,
      authorize(['super_admin', 'owner', 'manager']),
      validate({ body: updateUserSchema }),
    ],
  }, async (request, reply) => {
    const { name, phone, role, isActive } = request.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.is_active = isActive;

    // Prevent role escalation
    if (role) {
      const callerHierarchy = { super_admin: 6, owner: 5, manager: 4, waiter: 3, chef: 3, counter: 3 };
      if (callerHierarchy[role] >= callerHierarchy[request.user.role]) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Cannot assign equal or higher role' });
      }
    }

    const oldUser = await db('users').where({ id: request.params.id, tenant_id: request.tenantId }).first();
    if (!oldUser) return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found' });

    const [user] = await db('users')
      .where({ id: request.params.id, tenant_id: request.tenantId })
      .update(updates)
      .returning(['id', 'name', 'email', 'phone', 'role', 'is_active']);

    await logAudit({
      tenantId: request.tenantId,
      userId: request.user.userId,
      action: 'user_updated',
      entity: 'user',
      entityId: request.params.id,
      oldValue: { role: oldUser.role, is_active: oldUser.is_active },
      newValue: updates,
      ipAddress: request.ip,
      requestId: request.requestId,
    });

    return user;
  });

  // Delete user (soft)
  fastify.delete('/users/:id', {
    preHandler: [authenticate, tenantContext, authorize(['super_admin', 'owner'])],
  }, async (request) => {
    await db('users')
      .where({ id: request.params.id, tenant_id: request.tenantId })
      .update({ deleted_at: db.fn.now(), is_active: false });

    await logAudit({
      tenantId: request.tenantId,
      userId: request.user.userId,
      action: 'user_deleted',
      entity: 'user',
      entityId: request.params.id,
      requestId: request.requestId,
    });

    return { message: 'User deleted' };
  });

  // Global stats (super admin)
  fastify.get('/admin/stats', {
    preHandler: superAuth,
  }, async () => {
    const [tenantCount] = await db('tenants').whereNull('deleted_at').count();
    const [userCount] = await db('users').whereNull('deleted_at').count();
    const [orderCount] = await db('orders').count();
    const [revenue] = await db('bills').where({ status: 'paid' }).select(db.raw('COALESCE(SUM(total), 0) as total'));

    return {
      tenants: parseInt(tenantCount.count, 10),
      users: parseInt(userCount.count, 10),
      orders: parseInt(orderCount.count, 10),
      totalRevenue: parseFloat(revenue.total),
    };
  });

  // Audit logs (super admin or owner)
  fastify.get('/audit-logs', {
    preHandler: [authenticate, tenantContext, authorize(['super_admin', 'owner'])],
  }, async (request) => {
    const { getAuditLogs } = await import('../audit/audit.service.js');
    return getAuditLogs(request.tenantId, request.query);
  });
}
