import bcrypt from 'bcrypt';
import db from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function createTenant(data) {
  const existing = await db('tenants').where({ slug: data.slug }).first();
  if (existing) throw new ConflictError('Restaurant with this slug already exists');

  return db.transaction(async (trx) => {
    const [tenant] = await trx('tenants')
      .insert({
        name: data.name,
        slug: data.slug,
        address: data.address,
        phone: data.phone,
        email: data.email,
        currency: data.currency || 'INR',
        business_type: data.businessType || 'restaurant',
        tax_config: JSON.stringify(data.taxConfig || { cgst: 2.5, sgst: 2.5 }),
        service_charge_percent: data.businessType === 'cafe' ? 0 : (data.serviceChargePercent || 0),
      })
      .returning('*');

    await trx('tenant_branding').insert({ tenant_id: tenant.id });

    const passwordHash = await bcrypt.hash(data.ownerPassword, 12);
    const [owner] = await trx('users')
      .insert({
        tenant_id: tenant.id,
        name: data.ownerName,
        email: data.ownerEmail,
        password_hash: passwordHash,
        role: 'owner',
      })
      .returning(['id', 'name', 'email', 'role']);

    return { tenant, owner };
  });
}

export async function listTenants({ page = 1, limit = 20, search } = {}) {
  let query = db('tenants').whereNull('deleted_at');
  let countQuery = db('tenants').whereNull('deleted_at');

  if (search) {
    query = query.where((q) => {
      q.where('name', 'ilike', `%${search}%`).orWhere('slug', 'ilike', `%${search}%`);
    });
    countQuery = countQuery.where((q) => {
      q.where('name', 'ilike', `%${search}%`).orWhere('slug', 'ilike', `%${search}%`);
    });
  }

  const [{ count }] = await countQuery.count();
  const tenants = await query
    .select('*')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    data: tenants,
    meta: {
      total: parseInt(count, 10),
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
}

export async function getTenant(id) {
  const tenant = await db('tenants').where({ id }).whereNull('deleted_at').first();
  if (!tenant) throw new NotFoundError('Restaurant');

  const branding = await db('tenant_branding').where({ tenant_id: id }).first();
  return { ...tenant, branding };
}

export async function getTenantBySlug(slug) {
  const tenant = await db('tenants')
    .where({ slug, is_active: true })
    .whereNull('deleted_at')
    .first();
  if (!tenant) throw new NotFoundError('Restaurant');

  const branding = await db('tenant_branding').where({ tenant_id: tenant.id }).first();
  return { ...tenant, branding };
}

export async function updateTenant(id, data) {
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.address !== undefined) updates.address = data.address;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.email !== undefined) updates.email = data.email;
  if (data.currency !== undefined) updates.currency = data.currency;
  if (data.taxConfig !== undefined) updates.tax_config = JSON.stringify(data.taxConfig);
  if (data.serviceChargePercent !== undefined) updates.service_charge_percent = data.serviceChargePercent;
  if (data.sessionTimeoutMinutes !== undefined) updates.session_timeout_minutes = data.sessionTimeoutMinutes;
  if (data.isActive !== undefined) updates.is_active = data.isActive;

  if (Object.keys(updates).length === 0) return getTenant(id);

  await db('tenants').where({ id }).update(updates);
  return getTenant(id);
}

export async function updateBranding(tenantId, data) {
  const updates = {};
  if (data.primaryColor !== undefined) updates.primary_color = data.primaryColor;
  if (data.secondaryColor !== undefined) updates.secondary_color = data.secondaryColor;
  if (data.accentColor !== undefined) updates.accent_color = data.accentColor;
  if (data.fontFamily !== undefined) updates.font_family = data.fontFamily;
  if (data.logoUrl !== undefined) updates.logo_url = data.logoUrl;
  if (data.coverImageUrl !== undefined) updates.cover_image_url = data.coverImageUrl;
  if (data.template !== undefined) updates.template = data.template;
  if (data.tagline !== undefined) updates.tagline = data.tagline;
  if (data.faviconUrl !== undefined) updates.favicon_url = data.faviconUrl;
  if (data.promoBannerText !== undefined) updates.promo_banner_text = data.promoBannerText;
  if (data.promoBannerUrl !== undefined) updates.promo_banner_url = data.promoBannerUrl;

  await db('tenant_branding').where({ tenant_id: tenantId }).update(updates);
  return db('tenant_branding').where({ tenant_id: tenantId }).first();
}

export async function deleteTenant(id) {
  await db('tenants').where({ id }).update({ deleted_at: db.fn.now(), is_active: false });
}
