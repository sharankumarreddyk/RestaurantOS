/**
 * Notification system: persistent, role-targeted notifications.
 */
export async function up(knex) {
  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('target_user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('target_role', 20).nullable();
    t.uuid('target_table_id').nullable().references('id').inTable('tables').onDelete('SET NULL');
    t.string('type', 50).notNullable();
    t.string('title', 200).notNullable();
    t.string('body', 500).nullable();
    t.string('entity', 50).nullable();
    t.uuid('entity_id').nullable();
    t.boolean('is_read').defaultTo(false);
    t.timestamp('read_at').nullable();
    t.string('priority', 10).defaultTo('normal');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index(['tenant_id', 'target_role', 'is_read', 'created_at']);
    t.index(['target_user_id', 'is_read', 'created_at']);
    t.index(['target_table_id', 'is_read', 'created_at']);
    t.index('created_at');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('notifications');
}
