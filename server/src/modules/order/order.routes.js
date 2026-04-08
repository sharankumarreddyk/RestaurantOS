import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createOrderSchema, addItemsSchema, updateOrderStatusSchema, updateItemStatusSchema,
} from './order.schema.js';
import * as orderService from './order.service.js';
import { onOrderCreated, onOrderStatusChanged } from '../notification/notification.service.js';
import db from '../../config/database.js';

export default async function orderRoutes(fastify) {
  const staffAuth = [authenticate, tenantContext, requireTenant];

  // Place order (staff or customer)
  fastify.post('/orders', {
    preHandler: [authenticate, tenantContext, validate({ body: createOrderSchema })],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    const placedBy = request.user.role !== 'customer' ? request.user.userId : null;
    const sessionId = request.user.role === 'customer' ? request.user.sessionId : null;

    const idempotencyKey = request.headers['x-idempotency-key'] || null;
    const order = await orderService.createOrder(
      tenantId,
      { ...request.body, sessionId },
      placedBy,
      idempotencyKey
    );

    // Broadcast to kitchen via WebSocket
    if (fastify.ws) {
      fastify.ws.broadcast(tenantId, 'kitchen', {
        type: 'order:new',
        payload: order,
        timestamp: new Date().toISOString(),
      });
    }

    // Generate persistent notifications
    const table = await db('tables').where({ id: request.body.tableId }).first();
    onOrderCreated(tenantId, order, table).catch(() => {});

    return order;
  });

  // List orders
  fastify.get('/orders', {
    preHandler: staffAuth,
  }, async (request) => {
    return orderService.listOrders(request.tenantId, request.query);
  });

  // Get order detail
  fastify.get('/orders/:id', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    return orderService.getOrder(tenantId, request.params.id);
  });

  // Update order status
  fastify.put('/orders/:id/status', {
    preHandler: [...staffAuth, validate({ body: updateOrderStatusSchema })],
  }, async (request) => {
    const order = await orderService.updateOrderStatus(
      request.tenantId, request.params.id, request.body.status
    );

    // Broadcast status change
    if (fastify.ws) {
      fastify.ws.broadcast(request.tenantId, 'all', {
        type: 'order:status',
        payload: { orderId: order.id, status: order.status, tableId: order.table_id },
        timestamp: new Date().toISOString(),
      });
    }

    // Generate persistent notifications for status change
    const table = await db('tables').where({ id: order.table_id }).first();
    onOrderStatusChanged(request.tenantId, order, table, request.body.status).catch(() => {});

    return order;
  });

  // Update item status
  fastify.put('/orders/:id/items/:itemId/status', {
    preHandler: [...staffAuth, validate({ body: updateItemStatusSchema })],
  }, async (request) => {
    const item = await orderService.updateItemStatus(
      request.tenantId, request.params.id, request.params.itemId, request.body.status
    );

    if (fastify.ws) {
      fastify.ws.broadcast(request.tenantId, 'all', {
        type: 'order:item_status',
        payload: { orderId: request.params.id, itemId: item.id, status: item.status },
        timestamp: new Date().toISOString(),
      });
    }

    return item;
  });

  // Add items to existing order
  fastify.post('/orders/:id/items', {
    preHandler: [authenticate, tenantContext, validate({ body: addItemsSchema })],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    const newItems = await orderService.addItemsToOrder(
      tenantId, request.params.id, request.body.items
    );

    if (fastify.ws) {
      fastify.ws.broadcast(tenantId, 'kitchen', {
        type: 'order:updated',
        payload: { orderId: request.params.id, newItems },
        timestamp: new Date().toISOString(),
      });
    }

    return newItems;
  });

  // Remove item
  fastify.delete('/orders/:id/items/:itemId', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    return orderService.removeItem(tenantId, request.params.id, request.params.itemId);
  });

  // Kitchen queue
  fastify.get('/orders/kitchen', {
    preHandler: [...staffAuth, authorize(['super_admin', 'owner', 'manager', 'chef', 'cafe_operator'])],
  }, async (request) => {
    return orderService.getKitchenQueue(request.tenantId);
  });

  // Active orders for table (customer)
  fastify.get('/orders/active', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    const tableId = request.query.tableId || request.user.tableId;
    if (!tableId) return [];
    return orderService.getActiveOrdersForTable(tenantId, tableId);
  });

  // Estimated wait time (public — shown before customer orders)
  fastify.get('/public/wait-time/:slug', async (request) => {
    const tenant = await db('tenants')
      .where({ slug: request.params.slug, is_active: true }).first();
    if (!tenant) return { estimatedMinutes: 10, busyLevel: 'low', message: 'Quick service expected' };
    return orderService.getEstimatedWaitTime(tenant.id);
  });
}
