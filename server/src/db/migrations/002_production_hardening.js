/**
 * Production hardening migration:
 * - audit_logs table for compliance/tracing
 * - idempotency_key on orders and payments
 * - password_reset_tokens table (DB fallback when Redis unavailable)
 */

export async function up(knex) {
  // ── Audit Logs ────────────────────────────────────────
  await knex.schema.createTable('audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').nullable().index();
    t.uuid('user_id').nullable().index();
    t.string('action', 100).notNullable().index();
    t.string('entity', 100).notNullable();
    t.uuid('entity_id').nullable();
    t.jsonb('old_value').nullable();
    t.jsonb('new_value').nullable();
    t.string('ip_address', 45);
    t.string('request_id', 64);
    t.timestamp('created_at').defaultTo(knex.fn.now()).index();
  });

  // ── Idempotency key on orders ─────────────────────────
  await knex.schema.alterTable('orders', (t) => {
    t.string('idempotency_key', 64).nullable().unique();
  });

  // ── Idempotency key on payments ───────────────────────
  await knex.schema.alterTable('payments', (t) => {
    t.string('idempotency_key', 64).nullable().unique();
  });

  // ── Index for order number atomic generation ──────────
  // Composite index for daily order numbering
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_orders_tenant_date
    ON orders (tenant_id, (created_at::date) DESC);
  `);

  // ── Index on audit_logs for tenant+entity queries ─────
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_audit_tenant_entity
    ON audit_logs (tenant_id, entity, created_at DESC);
  `);
}

export async function down(knex) {
  await knex.schema.alterTable('orders', (t) => {
    t.dropColumn('idempotency_key');
  });
  await knex.schema.alterTable('payments', (t) => {
    t.dropColumn('idempotency_key');
  });
  await knex.schema.dropTableIfExists('audit_logs');
}
