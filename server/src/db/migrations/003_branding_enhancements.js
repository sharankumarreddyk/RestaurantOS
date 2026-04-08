/**
 * Branding enhancements: tagline, favicon, promotional banner fields.
 */
export async function up(knex) {
  await knex.schema.alterTable('tenant_branding', (t) => {
    t.string('tagline', 200).nullable();
    t.string('favicon_url', 500).nullable();
    t.string('promo_banner_text', 300).nullable();
    t.string('promo_banner_url', 500).nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('tenant_branding', (t) => {
    t.dropColumn('tagline');
    t.dropColumn('favicon_url');
    t.dropColumn('promo_banner_text');
    t.dropColumn('promo_banner_url');
  });
}
