import { ForbiddenError } from '../utils/errors.js';

/**
 * Tenant isolation middleware.
 * Extracts tenant_id from JWT and injects into request.
 * Super admin can optionally target a tenant via X-Tenant-Id header.
 */
export function tenantContext(request, reply, done) {
  if (!request.user) {
    done();
    return;
  }

  if (request.user.role === 'super_admin') {
    // Super admin can target a specific tenant via header
    request.tenantId = request.headers['x-tenant-id'] || null;
  } else if (request.user.role === 'customer') {
    request.tenantId = request.user.tenantId;
    request.tableId = request.user.tableId;
    request.sessionId = request.user.sessionId;
  } else {
    if (!request.user.tenantId) {
      throw new ForbiddenError('No tenant context available');
    }
    request.tenantId = request.user.tenantId;
  }

  done();
}

/**
 * Require tenant context — fails if no tenant_id present.
 * Use after authenticate + tenantContext.
 */
export function requireTenant(request, reply, done) {
  if (!request.tenantId) {
    throw new ForbiddenError('Tenant context required');
  }
  done();
}
