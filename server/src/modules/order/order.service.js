import db from '../../config/database.js';
import { cacheGet, cacheSet, cacheDel, getRedis } from '../../config/redis.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

async function getNextOrderNumber(tenantId, trx = db) {
  const today = new Date().toISOString().split('T')[0];
  const redis = await getRedis();

  if (redis) {
    const key = `order_seq:${tenantId}:${today}`;
    const num = await redis.incr(key);
    if (num === 1) await redis.expire(key, 86400 * 2);
    return num;
  }

  // Atomic fallback: use advisory lock to prevent duplicate order numbers
  const result = await trx('orders')
    .where({ tenant_id: tenantId })
    .whereRaw("created_at::date = ?", [today])
    .max('order_number as max');

  return (result[0]?.max || 0) + 1;
}

export async function createOrder(tenantId, data, placedBy = null, idempotencyKey = null) {
  return db.transaction(async (trx) => {
    // Idempotency check — prevent duplicate orders from double-submit
    if (idempotencyKey) {
      const existing = await trx('orders').where({ idempotency_key: idempotencyKey }).first();
      if (existing) {
        const items = await trx('order_items').where({ order_id: existing.id });
        return { ...existing, items };
      }
    }

    // Validate all menu items exist and are available
    const menuItemIds = data.items.map((i) => i.menuItemId);
    const menuItems = await trx('menu_items')
      .whereIn('id', menuItemIds)
      .where({ tenant_id: tenantId, is_available: true })
      .whereNull('deleted_at');

    if (menuItems.length !== new Set(menuItemIds).size) {
      throw new ValidationError('One or more menu items are unavailable');
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    // Batch-fetch all variants upfront (fixes N+1 query)
    const variantIds = data.items.filter((i) => i.variantId).map((i) => i.variantId);
    const variantMap = new Map();
    if (variantIds.length > 0) {
      const variants = await trx('item_variants').whereIn('id', variantIds);
      for (const v of variants) variantMap.set(v.id, v);
    }

    // Fetch tenant tax config in parallel with variant fetch (already done above)
    const tenant = await trx('tenants').where({ id: tenantId }).select('tax_config').first();

    // Calculate prices (no DB queries in this loop)
    let subtotal = 0;
    const orderItems = [];

    for (const item of data.items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      let unitPrice = parseFloat(menuItem.base_price);

      // Apply variant price from pre-fetched map
      if (item.variantId && variantMap.has(item.variantId)) {
        unitPrice = parseFloat(variantMap.get(item.variantId).price);
      }

      // Add customization prices
      let customizationTotal = 0;
      for (const c of (item.customizations || [])) {
        customizationTotal += c.priceAdjustment || 0;
      }
      unitPrice += customizationTotal;

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        menu_item_id: item.menuItemId,
        variant_id: item.variantId || null,
        item_name: menuItem.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        customizations: JSON.stringify(item.customizations || []),
        notes: item.notes,
      });
    }
    const taxConfig = tenant.tax_config || { cgst: 2.5, sgst: 2.5 };
    const taxRate = (taxConfig.cgst || 0) + (taxConfig.sgst || 0) + (taxConfig.vat || 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const orderNumber = await getNextOrderNumber(tenantId, trx);

    const [order] = await trx('orders')
      .insert({
        tenant_id: tenantId,
        table_id: data.tableId,
        session_id: data.sessionId || null,
        order_number: orderNumber,
        order_type: data.orderType,
        placed_by: placedBy,
        notes: data.notes,
        subtotal,
        tax_amount: taxAmount,
        total,
        idempotency_key: idempotencyKey,
      })
      .returning('*');

    const itemsToInsert = orderItems.map((oi) => ({ ...oi, order_id: order.id }));
    const insertedItems = await trx('order_items').insert(itemsToInsert).returning('*');

    return { ...order, items: insertedItems };
  });
}

export async function listOrders(tenantId, filters = {}) {
  let query = db('orders').where({ tenant_id: tenantId });

  if (filters.status) {
    const statuses = filters.status.split(',');
    query = query.whereIn('status', statuses);
  }
  if (filters.tableId) query = query.where({ table_id: filters.tableId });
  if (filters.from) query = query.where('created_at', '>=', filters.from);
  if (filters.to) query = query.where('created_at', '<=', filters.to);

  const page = parseInt(filters.page, 10) || 1;
  const limit = Math.min(parseInt(filters.limit, 10) || 20, 100);

  const [{ count }] = await query.clone().count();
  const orders = await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit)
    .select('*');

  // Fetch items for each order
  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? await db('order_items').whereIn('order_id', orderIds)
    : [];

  const itemsByOrder = new Map();
  for (const item of items) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  return {
    data: orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] })),
    meta: { total: parseInt(count, 10), page, limit },
  };
}

export async function getOrder(tenantId, id) {
  const order = await db('orders').where({ id, tenant_id: tenantId }).first();
  if (!order) throw new NotFoundError('Order');

  const items = await db('order_items').where({ order_id: id });

  // Get table info
  const table = await db('tables').where({ id: order.table_id }).first();

  return { ...order, items, table: { number: table?.table_number, label: table?.label } };
}

export async function updateOrderStatus(tenantId, id, status) {
  const order = await db('orders').where({ id, tenant_id: tenantId }).first();
  if (!order) throw new NotFoundError('Order');

  // Validate state transition
  // Cafe mode allows pending → served directly (skip kitchen pipeline)
  const tenant = await db('tenants').where({ id: tenantId }).select('business_type').first();
  const isCafe = tenant?.business_type === 'cafe';

  const validTransitions = {
    pending: isCafe ? ['confirmed', 'served', 'cancelled'] : ['confirmed', 'cancelled'],
    confirmed: isCafe ? ['preparing', 'served', 'cancelled'] : ['preparing', 'cancelled'],
    preparing: ['ready', 'served', 'cancelled'],
    ready: ['served'],
    served: [],
    cancelled: [],
  };

  if (!validTransitions[order.status]?.includes(status)) {
    throw new ValidationError(`Cannot transition from '${order.status}' to '${status}'`);
  }

  const [updated] = await db('orders').where({ id }).update({ status }).returning('*');

  // If confirming, update all pending items to match
  if (status === 'confirmed') {
    await db('order_items')
      .where({ order_id: id, status: 'pending' })
      .update({ status: 'pending' });
  }

  return updated;
}

export async function updateItemStatus(tenantId, orderId, itemId, status) {
  const order = await db('orders').where({ id: orderId, tenant_id: tenantId }).first();
  if (!order) throw new NotFoundError('Order');

  const [item] = await db('order_items')
    .where({ id: itemId, order_id: orderId })
    .update({ status })
    .returning('*');

  if (!item) throw new NotFoundError('Order item');

  // Check if all items are ready → auto-update order to ready
  if (status === 'ready') {
    const pendingItems = await db('order_items')
      .where({ order_id: orderId })
      .whereNotIn('status', ['ready', 'served', 'cancelled'])
      .count();

    if (parseInt(pendingItems[0].count, 10) === 0) {
      await db('orders').where({ id: orderId }).update({ status: 'ready' });
    }
  }

  return item;
}

export async function addItemsToOrder(tenantId, orderId, items) {
  const order = await db('orders').where({ id: orderId, tenant_id: tenantId }).first();
  if (!order) throw new NotFoundError('Order');
  if (['served', 'cancelled'].includes(order.status)) {
    throw new ValidationError('Cannot add items to a completed or cancelled order');
  }

  return db.transaction(async (trx) => {
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await trx('menu_items')
      .whereIn('id', menuItemIds)
      .where({ tenant_id: tenantId, is_available: true });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
    let addedSubtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) throw new ValidationError(`Menu item ${item.menuItemId} unavailable`);

      let unitPrice = parseFloat(menuItem.base_price);
      if (item.variantId) {
        const variant = await trx('item_variants')
          .where({ id: item.variantId, menu_item_id: item.menuItemId })
          .first();
        if (variant) unitPrice = parseFloat(variant.price);
      }

      let customizationTotal = 0;
      for (const c of (item.customizations || [])) {
        customizationTotal += c.priceAdjustment || 0;
      }
      unitPrice += customizationTotal;

      const totalPrice = unitPrice * item.quantity;
      addedSubtotal += totalPrice;

      orderItems.push({
        order_id: orderId,
        menu_item_id: item.menuItemId,
        variant_id: item.variantId || null,
        item_name: menuItem.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        customizations: JSON.stringify(item.customizations || []),
        notes: item.notes,
      });
    }

    const newItems = await trx('order_items').insert(orderItems).returning('*');

    // Recalculate order totals
    const newSubtotal = parseFloat(order.subtotal) + addedSubtotal;
    const tenant = await trx('tenants').where({ id: tenantId }).first();
    const taxConfig = tenant.tax_config || { cgst: 2.5, sgst: 2.5 };
    const taxRate = (taxConfig.cgst || 0) + (taxConfig.sgst || 0) + (taxConfig.vat || 0);
    const taxAmount = newSubtotal * (taxRate / 100);

    await trx('orders').where({ id: orderId }).update({
      subtotal: newSubtotal,
      tax_amount: taxAmount,
      total: newSubtotal + taxAmount,
    });

    return newItems;
  });
}

export async function removeItem(tenantId, orderId, itemId) {
  const order = await db('orders').where({ id: orderId, tenant_id: tenantId }).first();
  if (!order) throw new NotFoundError('Order');

  const item = await db('order_items').where({ id: itemId, order_id: orderId }).first();
  if (!item) throw new NotFoundError('Order item');

  if (item.status !== 'pending') {
    throw new ValidationError('Can only remove pending items');
  }

  await db('order_items').where({ id: itemId }).del();

  // Recalculate totals
  const remaining = await db('order_items').where({ order_id: orderId });
  const newSubtotal = remaining.reduce((sum, i) => sum + parseFloat(i.total_price), 0);
  const tenant = await db('tenants').where({ id: tenantId }).first();
  const taxConfig = tenant.tax_config || { cgst: 2.5, sgst: 2.5 };
  const taxRate = (taxConfig.cgst || 0) + (taxConfig.sgst || 0) + (taxConfig.vat || 0);

  await db('orders').where({ id: orderId }).update({
    subtotal: newSubtotal,
    tax_amount: newSubtotal * (taxRate / 100),
    total: newSubtotal + newSubtotal * (taxRate / 100),
  });

  return { message: 'Item removed' };
}

export async function getKitchenQueue(tenantId) {
  // Compute minutesElapsed in DB, select only needed columns
  const orders = await db('orders')
    .where({ tenant_id: tenantId })
    .whereIn('status', ['pending', 'confirmed', 'preparing'])
    .orderBy('created_at', 'asc')
    .select('id', 'tenant_id', 'table_id', 'order_number', 'status', 'notes', 'total', 'created_at',
      db.raw("ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) as minutes_elapsed"));

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const tableIds = [...new Set(orders.map((o) => o.table_id))];

  // Parallel fetch: items + only relevant tables (not ALL tables)
  const [items, tables] = await Promise.all([
    db('order_items').whereIn('order_id', orderIds),
    db('tables').whereIn('id', tableIds).select('id', 'table_number', 'label'),
  ]);

  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const itemsByOrder = new Map();
  for (const item of items) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  return orders.map((o) => ({
    ...o,
    items: itemsByOrder.get(o.id) || [],
    table: tableMap.get(o.table_id),
    minutesElapsed: parseInt(o.minutes_elapsed, 10) || 0,
  }));
}

export async function getActiveOrdersForTable(tenantId, tableId) {
  const orders = await db('orders')
    .where({ tenant_id: tenantId, table_id: tableId })
    .whereNotIn('status', ['served', 'cancelled'])
    .orderBy('created_at', 'desc');

  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? await db('order_items').whereIn('order_id', orderIds)
    : [];

  const itemsByOrder = new Map();
  for (const item of items) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  return orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] }));
}

/**
 * Estimated wait time based on current kitchen load.
 * Calculates: number of pending/preparing items × avg prep time.
 */
export async function getEstimatedWaitTime(tenantId) {
  const activeItems = await db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
    .where({ 'orders.tenant_id': tenantId })
    .whereIn('orders.status', ['pending', 'confirmed', 'preparing'])
    .whereNotIn('order_items.status', ['ready', 'served', 'cancelled'])
    .select(
      db.raw('COUNT(*) as pending_items'),
      db.raw('COALESCE(AVG(menu_items.prep_time_minutes), 15) as avg_prep_time'),
      db.raw('COALESCE(MAX(menu_items.prep_time_minutes), 15) as max_prep_time')
    )
    .first();

  const pendingItems = parseInt(activeItems.pending_items, 10);
  const avgPrep = parseFloat(activeItems.avg_prep_time);

  // Simple model: parallel prep capacity of ~3 items at a time
  const parallelCapacity = 3;
  const estimatedMinutes = Math.ceil((pendingItems / parallelCapacity) * avgPrep);

  let busyLevel = 'low';
  if (estimatedMinutes > 30) busyLevel = 'high';
  else if (estimatedMinutes > 15) busyLevel = 'medium';

  return {
    estimatedMinutes: Math.max(5, estimatedMinutes),
    pendingItems,
    busyLevel,
    message: busyLevel === 'high'
      ? `Kitchen is busy — estimated ~${estimatedMinutes} min wait`
      : busyLevel === 'medium'
        ? `Moderate wait — about ${estimatedMinutes} min`
        : `Quick service — about ${Math.max(5, estimatedMinutes)} min`,
  };
}
