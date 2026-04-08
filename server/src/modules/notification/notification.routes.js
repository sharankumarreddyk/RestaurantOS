import { authenticate } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { callWaiterSchema } from './notification.schema.js';
import * as notificationService from './notification.service.js';
import db from '../../config/database.js';

export default async function notificationRoutes(fastify) {
  // Set wsManager reference so NotificationService can broadcast
  notificationService.setWsManager(fastify.ws);

  // List notifications for current user/role
  fastify.get('/notifications', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    const page = parseInt(request.query.page, 10) || 1;
    const limit = parseInt(request.query.limit, 10) || 50;

    return notificationService.list(tenantId, {
      userId: request.user.userId,
      role: request.user.role,
      tableId: request.user.tableId,
      page,
      limit,
    });
  });

  // Unread count
  fastify.get('/notifications/unread-count', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    const count = await notificationService.unreadCount(tenantId, {
      userId: request.user.userId,
      role: request.user.role,
      tableId: request.user.tableId,
    });
    return { count };
  });

  // Mark one as read
  fastify.put('/notifications/:id/read', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    await notificationService.markRead(request.params.id, tenantId);
    return { message: 'Marked as read' };
  });

  // Mark all as read
  fastify.put('/notifications/read-all', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    await notificationService.markAllRead(tenantId, {
      userId: request.user.userId,
      role: request.user.role,
      tableId: request.user.tableId,
    });
    return { message: 'All marked as read' };
  });

  // Customer: Call waiter / Request bill
  fastify.post('/notifications/call-waiter', {
    preHandler: [authenticate, tenantContext, validate({ body: callWaiterSchema })],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const tenantId = request.tenantId || request.user.tenantId;
    const tableId = request.user.tableId;
    if (!tableId) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'No table context' });
    }

    const table = await db('tables').where({ id: tableId }).first();
    const callType = request.body.type || 'waiter';

    if (callType === 'bill') {
      await notificationService.create({
        tenantId,
        type: 'call_bill',
        title: `Table ${table?.table_number || '?'} requests the bill`,
        targetRole: 'counter',
        entity: 'table',
        entityId: tableId,
        priority: 'high',
      });
      await notificationService.create({
        tenantId,
        type: 'call_bill',
        title: `Table ${table?.table_number || '?'} requests the bill`,
        targetRole: 'waiter',
        entity: 'table',
        entityId: tableId,
        priority: 'normal',
      });
    } else {
      await notificationService.create({
        tenantId,
        type: 'call_waiter',
        title: `Table ${table?.table_number || '?'} needs assistance`,
        targetRole: 'waiter',
        entity: 'table',
        entityId: tableId,
        priority: 'high',
      });
    }

    return { message: callType === 'bill' ? 'Bill requested' : 'Waiter called' };
  });
}
