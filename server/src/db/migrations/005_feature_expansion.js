/**
 * Feature expansion: feedback, inventory, reservations, combos,
 * translations, tips, time-based menus, aggregator orders.
 */
export async function up(knex) {

  // ── Customer Feedback ───────────────────────────────────
  await knex.schema.createTable('customer_feedback', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('order_id').nullable().references('id').inTable('orders').onDelete('SET NULL');
    t.uuid('table_id').nullable().references('id').inTable('tables').onDelete('SET NULL');
    t.uuid('session_id').nullable().references('id').inTable('table_sessions').onDelete('SET NULL');
    t.integer('overall_rating').notNullable(); // 1-5
    t.integer('food_rating').nullable();       // 1-5
    t.integer('service_rating').nullable();    // 1-5
    t.integer('ambience_rating').nullable();   // 1-5
    t.text('comment').nullable();
    t.string('customer_name', 100).nullable();
    t.string('customer_phone', 20).nullable();
    t.boolean('google_review_prompted').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['tenant_id', 'created_at']);
  });

  // ── Inventory ───────────────────────────────────────────
  await knex.schema.createTable('inventory_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('unit', 20).notNullable(); // kg, g, liters, ml, pieces, etc.
    t.decimal('current_stock', 10, 3).defaultTo(0);
    t.decimal('low_stock_threshold', 10, 3).defaultTo(0);
    t.decimal('cost_per_unit', 10, 2).defaultTo(0);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('deleted_at').nullable();
    t.index('tenant_id');
  });

  await knex.schema.createTable('menu_item_ingredients', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('CASCADE');
    t.uuid('inventory_item_id').notNullable().references('id').inTable('inventory_items').onDelete('CASCADE');
    t.decimal('quantity_needed', 10, 3).notNullable();
    t.index('menu_item_id');
    t.index('inventory_item_id');
  });

  await knex.schema.createTable('inventory_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('inventory_item_id').notNullable().references('id').inTable('inventory_items').onDelete('CASCADE');
    t.decimal('change_amount', 10, 3).notNullable();
    t.string('reason', 50).notNullable(); // 'order', 'restock', 'waste', 'adjustment'
    t.uuid('reference_id').nullable(); // order_id or null
    t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['inventory_item_id', 'created_at']);
    t.index('tenant_id');
  });

  // ── Reservations / Waitlist ─────────────────────────────
  await knex.schema.createTable('reservations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('customer_name', 100).notNullable();
    t.string('customer_phone', 20).notNullable();
    t.string('customer_email', 255).nullable();
    t.integer('party_size').notNullable().defaultTo(2);
    t.date('reservation_date').notNullable();
    t.time('reservation_time').notNullable();
    t.integer('duration_minutes').defaultTo(90);
    t.uuid('table_id').nullable().references('id').inTable('tables').onDelete('SET NULL');
    t.enum('status', ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']).defaultTo('pending');
    t.enum('type', ['reservation', 'waitlist']).defaultTo('reservation');
    t.integer('waitlist_position').nullable();
    t.integer('estimated_wait_minutes').nullable();
    t.text('notes').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.index(['tenant_id', 'reservation_date', 'status']);
    t.index(['tenant_id', 'status']);
  });

  // ── Combo / Meal Deals ──────────────────────────────────
  await knex.schema.createTable('combo_deals', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.string('image_url', 500).nullable();
    t.decimal('combo_price', 10, 2).notNullable();
    t.decimal('original_price', 10, 2).nullable(); // sum of individual items
    t.boolean('is_active').defaultTo(true);
    t.timestamp('valid_from').nullable();
    t.timestamp('valid_to').nullable();
    t.integer('sort_order').defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('deleted_at').nullable();
    t.index('tenant_id');
  });

  await knex.schema.createTable('combo_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('combo_id').notNullable().references('id').inTable('combo_deals').onDelete('CASCADE');
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('CASCADE');
    t.uuid('variant_id').nullable().references('id').inTable('item_variants').onDelete('SET NULL');
    t.integer('quantity').defaultTo(1);
    t.index('combo_id');
  });

  // ── Multi-Language Translations ─────────────────────────
  await knex.schema.createTable('menu_item_translations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('CASCADE');
    t.string('language_code', 5).notNullable(); // 'hi', 'ta', 'kn', 'mr', 'te', etc.
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.unique(['menu_item_id', 'language_code']);
    t.index('menu_item_id');
  });

  await knex.schema.createTable('menu_category_translations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('category_id').notNullable().references('id').inTable('menu_categories').onDelete('CASCADE');
    t.string('language_code', 5).notNullable();
    t.string('name', 200).notNullable();
    t.unique(['category_id', 'language_code']);
    t.index('category_id');
  });

  // ── Tips on Bills ───────────────────────────────────────
  await knex.schema.alterTable('bills', (t) => {
    t.decimal('tip_amount', 10, 2).defaultTo(0);
  });

  // ── Time-Based Menu Categories ──────────────────────────
  await knex.schema.alterTable('menu_categories', (t) => {
    t.time('available_from').nullable(); // e.g., '07:00'
    t.time('available_to').nullable();   // e.g., '11:00'
  });

  // ── Tenant: Google Review URL + Languages ───────────────
  await knex.schema.alterTable('tenants', (t) => {
    t.string('google_review_url', 500).nullable();
    t.jsonb('supported_languages').defaultTo(JSON.stringify(['en']));
    t.string('default_language', 5).defaultTo('en');
  });

  // ── Orders: Support aggregator source ───────────────────
  await knex.schema.alterTable('orders', (t) => {
    t.string('source', 30).defaultTo('dine_in'); // 'dine_in', 'takeaway', 'zomato', 'swiggy', 'website'
    t.string('external_order_id', 100).nullable();
    t.string('delivery_address', 500).nullable();
    t.string('customer_name', 100).nullable();
    t.string('customer_phone', 20).nullable();
  });

  // ── Updated_at trigger for new tables ───────────────────
  const tablesWithUpdatedAt = ['inventory_items', 'reservations', 'combo_deals'];
  for (const table of tablesWithUpdatedAt) {
    await knex.raw(`
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
  }
}

export async function down(knex) {
  await knex.schema.alterTable('orders', (t) => {
    t.dropColumn('source');
    t.dropColumn('external_order_id');
    t.dropColumn('delivery_address');
    t.dropColumn('customer_name');
    t.dropColumn('customer_phone');
  });
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('google_review_url');
    t.dropColumn('supported_languages');
    t.dropColumn('default_language');
  });
  await knex.schema.alterTable('menu_categories', (t) => {
    t.dropColumn('available_from');
    t.dropColumn('available_to');
  });
  await knex.schema.alterTable('bills', (t) => {
    t.dropColumn('tip_amount');
  });
  const tables = [
    'menu_category_translations', 'menu_item_translations',
    'combo_items', 'combo_deals', 'reservations',
    'inventory_logs', 'menu_item_ingredients', 'inventory_items',
    'customer_feedback',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
