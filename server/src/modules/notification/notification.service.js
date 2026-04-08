import db from '../../config/database.js';

// wsManager is set at boot by notification.routes.js
let wsManager = null;
export function setWsManager(ws) { wsManager = ws; }

/**
 * Central notification service.
 * Creates persistent notification + broadcasts via WebSocket.
 */
export async function create({
  tenantId,
  type,
  title,
  body = null,
  targetRole = null,
  targetUserId = null,
  targetTableId = null,
  entity = null,
  entityId = null,
  priority = 'normal',
}) {
  const [notification] = await db('notifications')
    .insert({
      tenant_id: tenantId,
      target_user_id: targetUserId,
      target_role: targetRole,
      target_table_id: targetTableId,
      type,
      title,
      body,
      entity,
      entity_id: entityId,
      priority,
    })
    .returning('*');

  // Broadcast via WebSocket
  if (wsManager) {
    const msg = {
      type: 'notification:new',
      payload: notification,
      timestamp: new Date().toISOString(),
    };

    if (targetTableId) {
      wsManager.broadcastToTable(tenantId, targetTableId, msg);
    }
    if (targetRole) {
      // Map roles to WebSocket channels
      const channelMap = {
        chef: 'kitchen',
        kitchen: 'kitchen',
        waiter: 'waiter',
        counter: 'counter',
        owner: 'all',
        manager: 'all',
      };
      const channel = channelMap[targetRole] || 'all';
      wsManager.broadcast(tenantId, channel, msg);
    }
    if (targetUserId) {
      // User-specific: broadcast to all channels, client filters by userId
      wsManager.broadcast(tenantId, 'all', msg);
    }
  }

  return notification;
}

/**
 * List notifications for a user/role with pagination.
 */
export async function list(tenantId, { userId, role, tableId, page = 1, limit = 50 } = {}) {
  let query = db('notifications').where({ tenant_id: tenantId });

  if (role === 'customer' && tableId) {
    query = query.where({ target_table_id: tableId });
  } else if (userId) {
    query = query.where(function () {
      this.where({ target_user_id: userId })
        .orWhere({ target_role: role })
        .orWhereIn('target_role', getRoleBroadcastRoles(role));
    });
  }

  const notifications = await query
    .orderBy('created_at', 'desc')
    .limit(Math.min(limit, 100))
    .offset((page - 1) * limit);

  return notifications;
}

/**
 * Unread count for a user/role.
 */
export async function unreadCount(tenantId, { userId, role, tableId } = {}) {
  let query = db('notifications')
    .where({ tenant_id: tenantId, is_read: false });

  if (role === 'customer' && tableId) {
    query = query.where({ target_table_id: tableId });
  } else if (userId) {
    query = query.where(function () {
      this.where({ target_user_id: userId })
        .orWhere({ target_role: role })
        .orWhereIn('target_role', getRoleBroadcastRoles(role));
    });
  }

  const [{ count }] = await query.count();
  return parseInt(count, 10);
}

/**
 * Mark a notification as read.
 */
export async function markRead(id, tenantId) {
  await db('notifications')
    .where({ id, tenant_id: tenantId })
    .update({ is_read: true, read_at: db.fn.now() });
}

/**
 * Mark all notifications as read for a user/role.
 */
export async function markAllRead(tenantId, { userId, role, tableId } = {}) {
  let query = db('notifications')
    .where({ tenant_id: tenantId, is_read: false });

  if (role === 'customer' && tableId) {
    query = query.where({ target_table_id: tableId });
  } else if (userId) {
    query = query.where(function () {
      this.where({ target_user_id: userId })
        .orWhere({ target_role: role })
        .orWhereIn('target_role', getRoleBroadcastRoles(role));
    });
  }

  await query.update({ is_read: true, read_at: db.fn.now() });
}

// Roles that should receive notifications targeted at a broader role
function getRoleBroadcastRoles(role) {
  const map = {
    owner: ['owner', 'manager', 'waiter', 'chef', 'counter'],
    manager: ['manager', 'waiter', 'chef', 'counter'],
    waiter: ['waiter'],
    chef: ['chef'],
    counter: ['counter'],
  };
  return map[role] || [role];
}

// ── Event Helpers ───────────────────────────────────────
// Called from order/billing routes after state changes.

export async function onOrderCreated(tenantId, order, table) {
  await create({
    tenantId,
    type: 'order_new',
    title: `New order #${order.order_number} — Table ${table?.table_number || '?'}`,
    body: `${order.items?.length || 0} items, ₹${parseFloat(order.total).toFixed(0)}`,
    targetRole: 'chef',
    entity: 'order',
    entityId: order.id,
    priority: 'high',
  });
  // Also notify waiters
  await create({
    tenantId,
    type: 'order_new',
    title: `New order #${order.order_number} — Table ${table?.table_number || '?'}`,
    targetRole: 'waiter',
    entity: 'order',
    entityId: order.id,
    priority: 'normal',
  });
}

export async function onOrderStatusChanged(tenantId, order, table, newStatus) {
  if (newStatus === 'confirmed') {
    await create({
      tenantId,
      type: 'order_confirmed',
      title: `Order #${order.order_number} confirmed`,
      targetTableId: order.table_id,
      entity: 'order',
      entityId: order.id,
    });
  } else if (newStatus === 'preparing') {
    await create({
      tenantId,
      type: 'order_preparing',
      title: `Order #${order.order_number} is being prepared`,
      targetTableId: order.table_id,
      entity: 'order',
      entityId: order.id,
    });
  } else if (newStatus === 'ready') {
    await create({
      tenantId,
      type: 'order_ready',
      title: `Order #${order.order_number} ready — Table ${table?.table_number || '?'}`,
      targetRole: 'waiter',
      entity: 'order',
      entityId: order.id,
      priority: 'high',
    });
    await create({
      tenantId,
      type: 'order_ready',
      title: 'Your order is ready!',
      body: `Order #${order.order_number} is ready to be served`,
      targetTableId: order.table_id,
      entity: 'order',
      entityId: order.id,
      priority: 'high',
    });
  } else if (newStatus === 'served') {
    await create({
      tenantId,
      type: 'order_served',
      title: `Order #${order.order_number} served`,
      targetTableId: order.table_id,
      entity: 'order',
      entityId: order.id,
      priority: 'low',
    });
  }
}

export async function onBillPaid(tenantId, bill, table) {
  await create({
    tenantId,
    type: 'bill_paid',
    title: `Bill #${bill.bill_number} paid — Table ${table?.table_number || '?'}`,
    body: `₹${parseFloat(bill.total).toFixed(0)}`,
    targetRole: 'waiter',
    entity: 'bill',
    entityId: bill.id,
  });
  await create({
    tenantId,
    type: 'bill_paid',
    title: `Bill #${bill.bill_number} paid — Table ${table?.table_number || '?'}`,
    targetRole: 'counter',
    entity: 'bill',
    entityId: bill.id,
  });
}
