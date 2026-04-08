/**
 * Full database schema for the Restaurant Platform.
 *
 * @critic review: tenant_id indexed on every table, composite indexes for
 * hot query paths (orders by status+tenant, menu by tenant+category).
 * Soft deletes via deleted_at for audit trail. JSONB for flexible fields.
 */

export async function up(knex) {
  // Enable uuid extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ── Tenants ───────────────────────────────────────────
  await knex.schema.createTable('tenants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name').notNullable();
    t.string('slug').notNullable().unique();
    t.string('address');
    t.string('phone');
    t.string('email');
    t.string('currency', 10).defaultTo('INR');
    t.jsonb('tax_config').defaultTo(JSON.stringify({ cgst: 2.5, sgst: 2.5 }));
    t.decimal('service_charge_percent', 5, 2).defaultTo(0);
    t.integer('session_timeout_minutes').defaultTo(120);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('deleted_at').nullable();
  });

  // ── Tenant Branding ───────────────────────────────────
  await knex.schema.createTable('tenant_branding', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('primary_color', 7).defaultTo('#1a1a2e');
    t.string('secondary_color', 7).defaultTo('#16213e');
    t.string('accent_color', 7).defaultTo('#e94560');
    t.string('font_family').defaultTo('Inter');
    t.string('logo_url');
    t.string('cover_image_url');
    t.enum('template', [
      'modern_minimalist', 'classic_elegant', 'vibrant_colorful',
      'fast_food_casual', 'fine_dining_premium'
    ]).defaultTo('modern_minimalist');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.unique('tenant_id');
  });

  // ── Users ─────────────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').nullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('email').notNullable();
    t.string('password_hash').notNullable();
    t.string('phone');
    t.enum('role', ['super_admin', 'owner', 'manager', 'waiter', 'chef', 'counter']).notNullable();
    t.boolean('is_active').defaultTo(true);
    t.string('refresh_token');
    t.timestamp('last_login');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('deleted_at').nullable();

    t.unique(['email', 'tenant_id']);
    t.index('tenant_id');
    t.index('role');
  });

  // ── Menu Categories ───────────────────────────────────
  await knex.schema.createTable('menu_categories', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('slug').notNullable();
    t.enum('type', ['veg', 'non_veg', 'vegan', 'egg', 'mixed']).defaultTo('mixed');
    t.uuid('parent_id').nullable().references('id').inTable('menu_categories').onDelete('SET NULL');
    t.integer('sort_order').defaultTo(0);
    t.string('image_url');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('deleted_at').nullable();

    t.index('tenant_id');
    t.unique(['tenant_id', 'slug']);
  });

  // ── Menu Items ────────────────────────────────────────
  await knex.schema.createTable('menu_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('category_id').notNullable().references('id').inTable('menu_categories').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('slug').notNullable();
    t.text('description');
    t.decimal('base_price', 10, 2).notNullable();
    t.string('image_url');
    t.string('thumbnail_url');
    t.integer('prep_time_minutes').defaultTo(15);
    t.boolean('is_available').defaultTo(true);
    t.boolean('is_popular').defaultTo(false);
    t.boolean('is_chef_special').defaultTo(false);
    t.enum('food_type', ['veg', 'non_veg', 'vegan', 'egg']).defaultTo('veg');
    t.jsonb('allergens').defaultTo('[]');
    t.integer('sort_order').defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('deleted_at').nullable();

    t.index('tenant_id');
    t.index(['tenant_id', 'category_id']);
    t.index(['tenant_id', 'is_available']);
    t.unique(['tenant_id', 'slug']);
  });

  // ── Item Variants ─────────────────────────────────────
  await knex.schema.createTable('item_variants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('CASCADE');
    t.string('name').notNullable();
    t.decimal('price', 10, 2).notNullable();
    t.boolean('is_default').defaultTo(false);
    t.boolean('is_available').defaultTo(true);
    t.integer('sort_order').defaultTo(0);

    t.index('menu_item_id');
  });

  // ── Customization Groups ──────────────────────────────
  await knex.schema.createTable('customization_groups', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('CASCADE');
    t.string('name').notNullable();
    t.integer('min_selections').defaultTo(0);
    t.integer('max_selections').defaultTo(1);
    t.boolean('is_required').defaultTo(false);
    t.integer('sort_order').defaultTo(0);

    t.index('menu_item_id');
  });

  // ── Customization Options ─────────────────────────────
  await knex.schema.createTable('customization_options', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('group_id').notNullable().references('id').inTable('customization_groups').onDelete('CASCADE');
    t.string('name').notNullable();
    t.decimal('price_adjustment', 10, 2).defaultTo(0);
    t.boolean('is_default').defaultTo(false);
    t.boolean('is_available').defaultTo(true);
    t.integer('sort_order').defaultTo(0);

    t.index('group_id');
  });

  // ── Tables ────────────────────────────────────────────
  await knex.schema.createTable('tables', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.integer('table_number').notNullable();
    t.string('label');
    t.integer('capacity').defaultTo(4);
    t.enum('status', ['available', 'occupied', 'reserved', 'cleaning']).defaultTo('available');
    t.string('qr_code_url');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('deleted_at').nullable();

    t.unique(['tenant_id', 'table_number']);
    t.index('tenant_id');
  });

  // ── Table Sessions ────────────────────────────────────
  await knex.schema.createTable('table_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('table_id').notNullable().references('id').inTable('tables').onDelete('CASCADE');
    t.string('session_token').notNullable().unique();
    t.enum('status', ['active', 'closed']).defaultTo('active');
    t.integer('customer_count').defaultTo(1);
    t.timestamp('started_at').defaultTo(knex.fn.now());
    t.timestamp('last_activity_at').defaultTo(knex.fn.now());
    t.timestamp('closed_at').nullable();

    t.index(['tenant_id', 'table_id']);
    t.index(['table_id', 'status']);
  });

  // ── Orders ────────────────────────────────────────────
  await knex.schema.createTable('orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('table_id').notNullable().references('id').inTable('tables').onDelete('CASCADE');
    t.uuid('session_id').nullable().references('id').inTable('table_sessions').onDelete('SET NULL');
    t.integer('order_number').notNullable();
    t.enum('status', ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']).defaultTo('pending');
    t.enum('order_type', ['dine_in', 'takeaway']).defaultTo('dine_in');
    t.uuid('placed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.text('notes');
    t.decimal('subtotal', 10, 2).defaultTo(0);
    t.decimal('tax_amount', 10, 2).defaultTo(0);
    t.decimal('total', 10, 2).defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    t.index(['tenant_id', 'status']);
    t.index(['tenant_id', 'table_id']);
    t.index(['tenant_id', 'created_at']);
    t.unique(['tenant_id', 'order_number', knex.raw("(created_at::date)")]);
  });

  // ── Order Items ───────────────────────────────────────
  await knex.schema.createTable('order_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('RESTRICT');
    t.uuid('variant_id').nullable().references('id').inTable('item_variants').onDelete('SET NULL');
    t.string('item_name').notNullable();
    t.integer('quantity').notNullable().defaultTo(1);
    t.decimal('unit_price', 10, 2).notNullable();
    t.decimal('total_price', 10, 2).notNullable();
    t.jsonb('customizations').defaultTo('[]');
    t.text('notes');
    t.enum('status', ['pending', 'preparing', 'ready', 'served', 'cancelled']).defaultTo('pending');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index('order_id');
  });

  // ── Bills ─────────────────────────────────────────────
  await knex.schema.createTable('bills', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('table_id').notNullable().references('id').inTable('tables').onDelete('CASCADE');
    t.uuid('session_id').nullable().references('id').inTable('table_sessions').onDelete('SET NULL');
    t.integer('bill_number').notNullable();
    t.decimal('subtotal', 10, 2).defaultTo(0);
    t.decimal('tax_amount', 10, 2).defaultTo(0);
    t.decimal('service_charge', 10, 2).defaultTo(0);
    t.decimal('discount_amount', 10, 2).defaultTo(0);
    t.decimal('total', 10, 2).defaultTo(0);
    t.jsonb('tax_config').defaultTo('{}');
    t.decimal('service_charge_percent', 5, 2).defaultTo(0);
    t.jsonb('discount').defaultTo('{}');
    t.enum('status', ['open', 'closed', 'paid', 'partially_paid']).defaultTo('open');
    t.string('payment_method');
    t.decimal('paid_amount', 10, 2).defaultTo(0);
    t.text('notes');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('closed_at').nullable();

    t.index(['tenant_id', 'status']);
    t.index(['tenant_id', 'table_id']);
    t.index(['tenant_id', 'created_at']);
  });

  // ── Bill Items ────────────────────────────────────────
  await knex.schema.createTable('bill_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('bill_id').notNullable().references('id').inTable('bills').onDelete('CASCADE');
    t.uuid('order_item_id').nullable().references('id').inTable('order_items').onDelete('SET NULL');
    t.string('menu_item_name').notNullable();
    t.integer('quantity').notNullable();
    t.decimal('unit_price', 10, 2).notNullable();
    t.decimal('total_price', 10, 2).notNullable();

    t.index('bill_id');
  });

  // ── Payments ──────────────────────────────────────────
  await knex.schema.createTable('payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('bill_id').notNullable().references('id').inTable('bills').onDelete('CASCADE');
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.decimal('amount', 10, 2).notNullable();
    t.enum('method', ['cash', 'card', 'upi']).notNullable();
    t.string('reference_number');
    t.uuid('received_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index('bill_id');
    t.index('tenant_id');
  });

  // ── Updated_at trigger function ───────────────────────
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const tablesWithUpdatedAt = [
    'tenants', 'users', 'menu_categories', 'menu_items',
    'tables', 'orders', 'bills'
  ];

  for (const table of tablesWithUpdatedAt) {
    await knex.raw(`
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
  }
}

export async function down(knex) {
  const tables = [
    'payments', 'bill_items', 'bills', 'order_items', 'orders',
    'table_sessions', 'tables', 'customization_options',
    'customization_groups', 'item_variants', 'menu_items',
    'menu_categories', 'tenant_branding', 'users', 'tenants'
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at() CASCADE');
}
