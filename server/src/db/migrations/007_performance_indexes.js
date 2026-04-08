/**
 * Performance indexes for hot query paths identified in optimization audit.
 */
export async function up(knex) {
  // Kitchen queue: orders by tenant + status + created_at
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_orders_kitchen_queue
    ON orders (tenant_id, status, created_at ASC)
    WHERE status IN ('pending', 'confirmed', 'preparing');
  `);

  // Order items by order_id + status (for item-level queries)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_order_items_status
    ON order_items (order_id, status);
  `);

  // Bills by tenant + table + status (for getBillForTable)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_bills_table_status
    ON bills (tenant_id, table_id, status)
    WHERE status IN ('open', 'partially_paid');
  `);

  // Notifications: unread count query (polled frequently)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (tenant_id, target_role, created_at DESC)
    WHERE is_read = false;
  `);

  // Table sessions: active sessions lookup
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_sessions_active
    ON table_sessions (tenant_id, table_id)
    WHERE status = 'active';
  `);

  // Customer feedback: stats queries
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_feedback_stats
    ON customer_feedback (tenant_id, created_at DESC, overall_rating);
  `);
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_orders_kitchen_queue');
  await knex.raw('DROP INDEX IF EXISTS idx_order_items_status');
  await knex.raw('DROP INDEX IF EXISTS idx_bills_table_status');
  await knex.raw('DROP INDEX IF EXISTS idx_notifications_unread');
  await knex.raw('DROP INDEX IF EXISTS idx_sessions_active');
  await knex.raw('DROP INDEX IF EXISTS idx_feedback_stats');
}
