import db from '../../config/database.js';
import { cacheGet, cacheSet } from '../../config/redis.js';

export async function getRevenue(tenantId, { period = 'daily', from, to } = {}) {
  let groupBy, dateFormat;
  switch (period) {
    case 'weekly':
      groupBy = db.raw("date_trunc('week', bills.created_at)");
      dateFormat = 'week';
      break;
    case 'monthly':
      groupBy = db.raw("date_trunc('month', bills.created_at)");
      dateFormat = 'month';
      break;
    default:
      groupBy = db.raw("bills.created_at::date");
      dateFormat = 'day';
  }

  let query = db('bills')
    .where({ tenant_id: tenantId, status: 'paid' });

  if (from) query = query.where('bills.created_at', '>=', from);
  if (to) query = query.where('bills.created_at', '<=', to);

  const revenue = await query
    .select(
      db.raw(`${groupBy.sql} as period`),
      db.raw('SUM(total) as total_revenue'),
      db.raw('SUM(tax_amount) as total_tax'),
      db.raw('SUM(discount_amount) as total_discount'),
      db.raw('COUNT(*) as bill_count')
    )
    .groupByRaw(groupBy.sql)
    .orderByRaw(`${groupBy.sql} ASC`);

  const totalRevenue = revenue.reduce((s, r) => s + parseFloat(r.total_revenue), 0);

  return { data: revenue, summary: { totalRevenue, period: dateFormat } };
}

export async function getOrderStats(tenantId, { period = 'daily', from, to } = {}) {
  let query = db('orders').where({ tenant_id: tenantId });
  if (from) query = query.where('created_at', '>=', from);
  if (to) query = query.where('created_at', '<=', to);

  const stats = await query
    .select(
      db.raw('COUNT(*) as total_orders'),
      db.raw("COUNT(*) FILTER (WHERE status = 'served') as completed_orders"),
      db.raw("COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders"),
      db.raw('AVG(total) as avg_order_value'),
      db.raw('SUM(total) as total_value')
    )
    .first();

  // Orders by hour
  const hourly = await db('orders')
    .where({ tenant_id: tenantId })
    .whereNot({ status: 'cancelled' })
    .modify((q) => {
      if (from) q.where('created_at', '>=', from);
      if (to) q.where('created_at', '<=', to);
    })
    .select(
      db.raw('EXTRACT(HOUR FROM created_at)::int as hour'),
      db.raw('COUNT(*) as count')
    )
    .groupByRaw('EXTRACT(HOUR FROM created_at)')
    .orderBy('hour');

  return { ...stats, hourlyDistribution: hourly };
}

export async function getPopularItems(tenantId, { limit = 10, from, to } = {}) {
  let query = db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .where({ 'orders.tenant_id': tenantId })
    .whereNot({ 'order_items.status': 'cancelled' });

  if (from) query = query.where('orders.created_at', '>=', from);
  if (to) query = query.where('orders.created_at', '<=', to);

  return query
    .select(
      'order_items.menu_item_id',
      'order_items.item_name',
      db.raw('SUM(order_items.quantity) as total_quantity'),
      db.raw('SUM(order_items.total_price) as total_revenue'),
      db.raw('COUNT(DISTINCT orders.id) as order_count')
    )
    .groupBy('order_items.menu_item_id', 'order_items.item_name')
    .orderBy('total_quantity', 'desc')
    .limit(limit);
}

export async function getCategorySales(tenantId, { from, to } = {}) {
  let query = db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .join('menu_items', 'order_items.menu_item_id', 'menu_items.id')
    .join('menu_categories', 'menu_items.category_id', 'menu_categories.id')
    .where({ 'orders.tenant_id': tenantId })
    .whereNot({ 'order_items.status': 'cancelled' });

  if (from) query = query.where('orders.created_at', '>=', from);
  if (to) query = query.where('orders.created_at', '<=', to);

  return query
    .select(
      'menu_categories.id as category_id',
      'menu_categories.name as category_name',
      db.raw('SUM(order_items.total_price) as total_revenue'),
      db.raw('SUM(order_items.quantity) as total_quantity')
    )
    .groupBy('menu_categories.id', 'menu_categories.name')
    .orderBy('total_revenue', 'desc');
}

export async function getDashboard(tenantId) {
  const cacheKey = `dashboard:${tenantId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const today = new Date().toISOString().split('T')[0];

  const [todayRevenue] = await db('bills')
    .where({ tenant_id: tenantId, status: 'paid' })
    .whereRaw('created_at::date = ?', [today])
    .select(
      db.raw('COALESCE(SUM(total), 0) as revenue'),
      db.raw('COUNT(*) as bill_count')
    );

  const [todayOrders] = await db('orders')
    .where({ tenant_id: tenantId })
    .whereRaw('created_at::date = ?', [today])
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE status = 'served') as served"),
      db.raw("COUNT(*) FILTER (WHERE status NOT IN ('served', 'cancelled')) as active"),
      db.raw('COALESCE(AVG(total), 0) as avg_value')
    );

  const popularItems = await getPopularItems(tenantId, { limit: 5, from: today });

  const activeTables = await db('tables')
    .where({ tenant_id: tenantId, status: 'occupied' })
    .whereNull('deleted_at')
    .count()
    .first();

  const totalTables = await db('tables')
    .where({ tenant_id: tenantId, is_active: true })
    .whereNull('deleted_at')
    .count()
    .first();

  const result = {
    today: {
      revenue: parseFloat(todayRevenue.revenue),
      billCount: parseInt(todayRevenue.bill_count, 10),
      totalOrders: parseInt(todayOrders.total, 10),
      servedOrders: parseInt(todayOrders.served, 10),
      activeOrders: parseInt(todayOrders.active, 10),
      avgOrderValue: parseFloat(todayOrders.avg_value),
    },
    tables: {
      occupied: parseInt(activeTables.count, 10),
      total: parseInt(totalTables.count, 10),
    },
    popularItems,
  };

  await cacheSet(cacheKey, result, 60); // 1 min TTL
  return result;
}
