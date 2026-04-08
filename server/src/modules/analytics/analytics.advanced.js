import db from '../../config/database.js';

/**
 * Advanced analytics: profitability, retention, heatmap, feedback trends.
 */

export async function getItemProfitability(tenantId, { from, to, limit = 20 } = {}) {
  let query = db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .leftJoin('menu_item_ingredients', 'order_items.menu_item_id', 'menu_item_ingredients.menu_item_id')
    .leftJoin('inventory_items', 'menu_item_ingredients.inventory_item_id', 'inventory_items.id')
    .where({ 'orders.tenant_id': tenantId })
    .whereNot({ 'order_items.status': 'cancelled' });

  if (from) query = query.where('orders.created_at', '>=', from);
  if (to) query = query.where('orders.created_at', '<=', to);

  return query
    .select(
      'order_items.menu_item_id',
      'order_items.item_name',
      db.raw('SUM(order_items.total_price) as revenue'),
      db.raw('SUM(order_items.quantity) as units_sold'),
      db.raw('COALESCE(SUM(menu_item_ingredients.quantity_needed * inventory_items.cost_per_unit * order_items.quantity), 0) as estimated_cost'),
      db.raw('SUM(order_items.total_price) - COALESCE(SUM(menu_item_ingredients.quantity_needed * inventory_items.cost_per_unit * order_items.quantity), 0) as estimated_profit'),
    )
    .groupBy('order_items.menu_item_id', 'order_items.item_name')
    .orderBy('estimated_profit', 'desc')
    .limit(limit);
}

export async function getPeakHoursHeatmap(tenantId, { from, to } = {}) {
  let query = db('orders')
    .where({ tenant_id: tenantId })
    .whereNot({ status: 'cancelled' });

  if (from) query = query.where('created_at', '>=', from);
  if (to) query = query.where('created_at', '<=', to);

  return query
    .select(
      db.raw('EXTRACT(DOW FROM created_at)::int as day_of_week'),   // 0=Sun, 6=Sat
      db.raw('EXTRACT(HOUR FROM created_at)::int as hour'),
      db.raw('COUNT(*) as order_count'),
      db.raw('SUM(total) as revenue'),
    )
    .groupByRaw('EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)')
    .orderBy('day_of_week')
    .orderBy('hour');
}

export async function getTableTurnoverStats(tenantId, { from, to } = {}) {
  let query = db('table_sessions')
    .where({ tenant_id: tenantId, status: 'closed' });

  if (from) query = query.where('started_at', '>=', from);
  if (to) query = query.where('started_at', '<=', to);

  const stats = await query
    .select(
      db.raw('COUNT(*) as total_sessions'),
      db.raw("AVG(EXTRACT(EPOCH FROM (closed_at - started_at)) / 60) as avg_duration_minutes"),
      db.raw("MIN(EXTRACT(EPOCH FROM (closed_at - started_at)) / 60) as min_duration_minutes"),
      db.raw("MAX(EXTRACT(EPOCH FROM (closed_at - started_at)) / 60) as max_duration_minutes"),
    )
    .first();

  // Per-table stats
  const perTable = await db('table_sessions')
    .where({ tenant_id: tenantId, status: 'closed' })
    .modify((q) => { if (from) q.where('started_at', '>=', from); if (to) q.where('started_at', '<=', to); })
    .join('tables', 'table_sessions.table_id', 'tables.id')
    .select(
      'tables.table_number',
      db.raw('COUNT(*) as sessions'),
      db.raw("ROUND(AVG(EXTRACT(EPOCH FROM (table_sessions.closed_at - table_sessions.started_at)) / 60)) as avg_minutes"),
    )
    .groupBy('tables.table_number')
    .orderBy('sessions', 'desc');

  return { ...stats, perTable };
}

export async function getFeedbackTrend(tenantId, { from, to } = {}) {
  let query = db('customer_feedback').where({ tenant_id: tenantId });
  if (from) query = query.where('created_at', '>=', from);
  if (to) query = query.where('created_at', '<=', to);

  return query
    .select(
      db.raw("created_at::date as date"),
      db.raw('ROUND(AVG(overall_rating), 1) as avg_rating'),
      db.raw('COUNT(*) as review_count'),
    )
    .groupByRaw("created_at::date")
    .orderBy('date', 'desc')
    .limit(30);
}
