import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { createTenantSchema, updateTenantSchema, updateBrandingSchema } from './tenant.schema.js';
import * as tenantService from './tenant.service.js';

export default async function tenantRoutes(fastify) {
  // ── Super Admin: Tenant CRUD ─────────────────────────
  fastify.post('/admin/tenants', {
    preHandler: [
      authenticate, authorize(['super_admin']),
      validate({ body: createTenantSchema }),
    ],
  }, async (request) => {
    return tenantService.createTenant(request.body);
  });

  fastify.get('/admin/tenants', {
    preHandler: [authenticate, authorize(['super_admin'])],
  }, async (request) => {
    const { page, limit, search } = request.query;
    return tenantService.listTenants({ page: Number(page) || 1, limit: Number(limit) || 20, search });
  });

  fastify.get('/admin/tenants/:id', {
    preHandler: [authenticate, authorize(['super_admin'])],
  }, async (request) => {
    return tenantService.getTenant(request.params.id);
  });

  fastify.put('/admin/tenants/:id', {
    preHandler: [
      authenticate, authorize(['super_admin']),
      validate({ body: updateTenantSchema }),
    ],
  }, async (request) => {
    return tenantService.updateTenant(request.params.id, request.body);
  });

  fastify.delete('/admin/tenants/:id', {
    preHandler: [authenticate, authorize(['super_admin'])],
  }, async (request) => {
    await tenantService.deleteTenant(request.params.id);
    return { message: 'Restaurant deleted' };
  });

  // ── Tenant Profile (Owner/Manager) ───────────────────
  fastify.get('/tenant/profile', {
    preHandler: [authenticate, tenantContext, requireTenant],
  }, async (request) => {
    return tenantService.getTenant(request.tenantId);
  });

  fastify.put('/tenant/profile', {
    preHandler: [
      authenticate, tenantContext, requireTenant,
      authorize(['owner', 'manager']),
      validate({ body: updateTenantSchema }),
    ],
  }, async (request) => {
    return tenantService.updateTenant(request.tenantId, request.body);
  });

  // ── Branding ─────────────────────────────────────────
  fastify.get('/tenant/branding', {
    preHandler: [authenticate, tenantContext, requireTenant],
  }, async (request) => {
    const tenant = await tenantService.getTenant(request.tenantId);
    return tenant.branding;
  });

  fastify.put('/tenant/branding', {
    preHandler: [
      authenticate, tenantContext, requireTenant,
      authorize(['owner', 'manager']),
      validate({ body: updateBrandingSchema }),
    ],
  }, async (request) => {
    return tenantService.updateBranding(request.tenantId, request.body);
  });

  // ── Public ───────────────────────────────────────────
  fastify.get('/public/tenant/:slug', async (request) => {
    return tenantService.getTenantBySlug(request.params.slug);
  });
}
