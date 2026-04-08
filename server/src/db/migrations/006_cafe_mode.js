/**
 * Cafe mode: business_type on tenants, cafe_operator role.
 */
export async function up(knex) {
  // Add business_type to tenants
  await knex.schema.alterTable('tenants', (t) => {
    t.string('business_type', 20).defaultTo('restaurant');
  });

  // Extend the user role enum to include cafe_operator
  // PostgreSQL enum alteration
  await knex.raw(`
    ALTER TYPE "users_role_check" RENAME TO "users_role_check_old";
  `).catch(() => {
    // enum constraint might have a different name
  });

  // Drop old check constraint and add new one
  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  `);
  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'owner', 'manager', 'waiter', 'chef', 'counter', 'cafe_operator'));
  `);
}

export async function down(knex) {
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('business_type');
  });

  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  `);
  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'owner', 'manager', 'waiter', 'chef', 'counter'));
  `);
}
