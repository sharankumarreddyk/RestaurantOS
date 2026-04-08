import { authenticate, authorize, optionalAuth } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { submitFeedbackSchema } from './feedback.schema.js';
import * as feedbackService from './feedback.service.js';

export default async function feedbackRoutes(fastify) {
  // Submit feedback (customer — auth optional for anonymous feedback)
  fastify.post('/feedback', {
    preHandler: [optionalAuth, tenantContext, validate({ body: submitFeedbackSchema })],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const tenantId = request.tenantId || request.user?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Tenant context required' });
    return feedbackService.submitFeedback(tenantId, {
      ...request.body,
      tableId: request.user?.tableId || request.body.tableId,
      sessionId: request.user?.sessionId || request.body.sessionId,
    });
  });

  // Get Google Review URL (public for post-feedback redirect)
  fastify.get('/public/feedback/google-url/:slug', async (request) => {
    const tenant = await fastify.knex('tenants')
      .where({ slug: request.params.slug, is_active: true }).first();
    if (!tenant) return { url: null };
    return { url: tenant.google_review_url };
  });

  // List feedback (owner/manager)
  fastify.get('/feedback', {
    preHandler: [authenticate, tenantContext, requireTenant, authorize(['super_admin', 'owner', 'manager'])],
  }, async (request) => {
    return feedbackService.listFeedback(request.tenantId, request.query);
  });

  // Feedback stats (owner/manager)
  fastify.get('/feedback/stats', {
    preHandler: [authenticate, tenantContext, requireTenant, authorize(['super_admin', 'owner', 'manager'])],
  }, async (request) => {
    return feedbackService.getFeedbackStats(request.tenantId, request.query);
  });
}
