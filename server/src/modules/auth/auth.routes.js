import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  loginSchema, registerSchema, changePasswordSchema,
  passwordResetRequestSchema, passwordResetSchema,
} from './auth.schema.js';
import * as authService from './auth.service.js';
import config from '../../config/index.js';

export default async function authRoutes(fastify) {
  const cookieOpts = {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60,
  };

  // Login — stricter rate limit
  fastify.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [validate({ body: loginSchema })],
  }, async (request, reply) => {
    const result = await authService.login(
      request.body.email,
      request.body.password,
      request.ip
    );
    reply.setCookie('refreshToken', result.refreshToken, cookieOpts);
    return { user: result.user, accessToken: result.accessToken };
  });

  // Register (staff only — by owner/manager or super_admin)
  fastify.post('/auth/register', {
    preHandler: [
      authenticate,
      tenantContext,
      authorize(['super_admin', 'owner', 'manager']),
      validate({ body: registerSchema }),
    ],
  }, async (request, reply) => {
    const tenantId = request.body.tenantId || request.tenantId;
    const callerRole = request.user.role;
    const targetRole = request.body.role;

    const roleHierarchy = { super_admin: 6, owner: 5, manager: 4, waiter: 3, chef: 3, counter: 3, cafe_operator: 3 };
    if (roleHierarchy[targetRole] >= roleHierarchy[callerRole]) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Cannot create a user with equal or higher role' });
    }

    return authService.register({ ...request.body, tenantId });
  });

  // Refresh token
  fastify.post('/auth/refresh', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken || request.body?.refreshToken;
    if (!refreshToken) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'No refresh token provided' });
    }

    const tokens = await authService.refreshTokens(refreshToken);
    reply.setCookie('refreshToken', tokens.refreshToken, cookieOpts);
    return { accessToken: tokens.accessToken };
  });

  // Logout — blacklists current access token
  fastify.post('/auth/logout', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    await authService.logout(request.user.userId, request.user.jti);
    reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return { message: 'Logged out' };
  });

  // Current user profile
  fastify.get('/auth/me', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    return authService.getProfile(request.user.userId);
  });

  // Change password
  fastify.put('/auth/password', {
    preHandler: [authenticate, validate({ body: changePasswordSchema })],
  }, async (request) => {
    await authService.changePassword(
      request.user.userId,
      request.body.currentPassword,
      request.body.newPassword
    );
    return { message: 'Password changed. Please log in again.' };
  });

  // ── Password Reset ────────────────────────────────────

  fastify.post('/auth/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    preHandler: [validate({ body: passwordResetRequestSchema })],
  }, async (request) => {
    return authService.requestPasswordReset(request.body.email);
  });

  fastify.post('/auth/reset-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    preHandler: [validate({ body: passwordResetSchema })],
  }, async (request) => {
    return authService.resetPassword(request.body.token, request.body.newPassword);
  });

  // Customer session (public — no auth needed)
  fastify.get('/public/session/:slug/:tableId', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { slug, tableId } = request.params;
    const tenant = await fastify.knex('tenants')
      .where({ slug, is_active: true })
      .whereNull('deleted_at')
      .first();
    if (!tenant) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Restaurant not found' });
    }
    return authService.createCustomerSession(tenant.id, tableId);
  });
}
