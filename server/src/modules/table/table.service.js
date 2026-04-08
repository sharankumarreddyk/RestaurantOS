import QRCode from 'qrcode';
import db from '../../config/database.js';
import config from '../../config/index.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listTables(tenantId) {
  const tables = await db('tables')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at')
    .orderBy('table_number');

  // Get active sessions for occupied tables
  const occupiedIds = tables.filter((t) => t.status === 'occupied').map((t) => t.id);
  const sessions = occupiedIds.length
    ? await db('table_sessions')
        .whereIn('table_id', occupiedIds)
        .where({ status: 'active' })
    : [];

  const sessionMap = new Map(sessions.map((s) => [s.table_id, s]));

  return tables.map((t) => ({
    ...t,
    activeSession: sessionMap.get(t.id) || null,
  }));
}

export async function createTable(tenantId, data) {
  const existing = await db('tables')
    .where({ tenant_id: tenantId, table_number: data.tableNumber })
    .whereNull('deleted_at')
    .first();
  if (existing) throw new ConflictError(`Table #${data.tableNumber} already exists`);

  const [table] = await db('tables')
    .insert({
      tenant_id: tenantId,
      table_number: data.tableNumber,
      label: data.label,
      capacity: data.capacity,
    })
    .returning('*');

  // Generate QR code
  const tenant = await db('tenants').where({ id: tenantId }).first();
  const qrUrl = `${config.baseUrl}/r/${tenant.slug}/t/${table.id}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });

  await db('tables').where({ id: table.id }).update({ qr_code_url: qrDataUrl });
  table.qr_code_url = qrDataUrl;

  return table;
}

export async function updateTable(tenantId, id, data) {
  const updates = {};
  if (data.label !== undefined) updates.label = data.label;
  if (data.capacity !== undefined) updates.capacity = data.capacity;
  if (data.isActive !== undefined) updates.is_active = data.isActive;

  const [table] = await db('tables')
    .where({ id, tenant_id: tenantId })
    .whereNull('deleted_at')
    .update(updates)
    .returning('*');

  if (!table) throw new NotFoundError('Table');
  return table;
}

export async function updateStatus(tenantId, id, status) {
  const [table] = await db('tables')
    .where({ id, tenant_id: tenantId })
    .update({ status })
    .returning('*');
  if (!table) throw new NotFoundError('Table');

  // If setting to available, close any active session
  if (status === 'available') {
    await db('table_sessions')
      .where({ table_id: id, status: 'active' })
      .update({ status: 'closed', closed_at: db.fn.now() });
  }

  return table;
}

export async function deleteTable(tenantId, id) {
  const result = await db('tables')
    .where({ id, tenant_id: tenantId })
    .update({ deleted_at: db.fn.now() });
  if (!result) throw new NotFoundError('Table');
}

export async function generateQR(tenantId, id) {
  const table = await db('tables').where({ id, tenant_id: tenantId }).first();
  if (!table) throw new NotFoundError('Table');

  const tenant = await db('tenants').where({ id: tenantId }).first();
  const branding = await db('tenant_branding').where({ tenant_id: tenantId }).first();
  const qrUrl = `${config.baseUrl}/r/${tenant.slug}/t/${table.id}`;

  // Branded QR: use restaurant's primary color
  const qrColor = branding?.primary_color || '#000000';
  const qrOpts = {
    width: 600,
    margin: 2,
    color: { dark: qrColor, light: '#ffffff' },
  };

  const [svgStr, dataUrl] = await Promise.all([
    QRCode.toString(qrUrl, { ...qrOpts, type: 'svg', width: 300 }),
    QRCode.toDataURL(qrUrl, qrOpts),
  ]);

  await db('tables').where({ id }).update({ qr_code_url: dataUrl });

  return {
    dataUrl,
    url: qrUrl,
    brandColor: qrColor,
    tableNumber: table.table_number,
    restaurantName: tenant.name,
  };
}

export async function closeSession(tenantId, tableId) {
  await db('table_sessions')
    .where({ table_id: tableId, tenant_id: tenantId, status: 'active' })
    .update({ status: 'closed', closed_at: db.fn.now() });

  await db('tables').where({ id: tableId, tenant_id: tenantId }).update({ status: 'available' });
  return { message: 'Session closed' };
}

export async function getTableOverview(tenantId) {
  // Fetch tables + active orders + order items in parallel (was 3 sequential)
  const tables = await db('tables')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at')
    .orderBy('table_number');

  const occupiedIds = tables.filter((t) => t.status === 'occupied').map((t) => t.id);

  if (occupiedIds.length === 0) {
    return tables.map((t) => ({ ...t, activeSession: null, activeOrders: [], activeOrderCount: 0 }));
  }

  // Parallel: orders + sessions + order items
  const [orders, sessions, orderItems] = await Promise.all([
    db('orders')
      .whereIn('table_id', occupiedIds)
      .where({ tenant_id: tenantId })
      .whereNotIn('status', ['served', 'cancelled'])
      .select('id', 'table_id', 'order_number', 'status', 'total', 'notes', 'created_at'),
    db('table_sessions')
      .whereIn('table_id', occupiedIds)
      .where({ status: 'active' }),
    db('order_items')
      .whereIn('order_id',
        db('orders')
          .whereIn('table_id', occupiedIds)
          .where({ tenant_id: tenantId })
          .whereNotIn('status', ['served', 'cancelled'])
          .select('id')
      ),
  ]);

  const sessionMap = new Map(sessions.map((s) => [s.table_id, s]));

  // Build items per order
  const itemsByOrder = new Map();
  for (const item of orderItems) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  // Build orders per table (with items embedded)
  const ordersByTable = new Map();
  for (const order of orders) {
    if (!ordersByTable.has(order.table_id)) ordersByTable.set(order.table_id, []);
    ordersByTable.get(order.table_id).push({
      ...order,
      items: itemsByOrder.get(order.id) || [],
    });
  }

  return tables.map((t) => ({
    ...t,
    activeSession: sessionMap.get(t.id) || null,
    activeOrders: ordersByTable.get(t.id) || [],
    activeOrderCount: (ordersByTable.get(t.id) || []).length,
  }));
}
