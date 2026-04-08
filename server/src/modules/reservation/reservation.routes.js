import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { createReservationSchema, updateReservationStatusSchema, addWaitlistSchema } from './reservation.schema.js';
import * as reservationService from './reservation.service.js';

export default async function reservationRoutes(fastify) {
  const staffAuth = [authenticate, tenantContext, requireTenant];
  const managerAuth = [...staffAuth, authorize(['super_admin', 'owner', 'manager', 'waiter'])];

  // Create reservation (staff)
  fastify.post('/reservations', {
    preHandler: [...managerAuth, validate({ body: createReservationSchema })],
  }, async (request) => {
    return reservationService.createReservation(request.tenantId, request.body);
  });

  // Public reservation (guest booking — validated)
  fastify.post('/public/reservations/:slug', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    preHandler: [validate({ body: createReservationSchema })],
  }, async (request, reply) => {
    const tenant = await fastify.knex('tenants').where({ slug: request.params.slug, is_active: true }).first();
    if (!tenant) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Restaurant not found' });
    return reservationService.createReservation(tenant.id, request.body);
  });

  // List reservations
  fastify.get('/reservations', { preHandler: managerAuth }, async (request) => {
    return reservationService.listReservations(request.tenantId, request.query);
  });

  // Update status
  fastify.put('/reservations/:id/status', {
    preHandler: [...managerAuth, validate({ body: updateReservationStatusSchema })],
  }, async (request) => {
    return reservationService.updateReservationStatus(request.tenantId, request.params.id, request.body.status);
  });

  // Waitlist: add (staff)
  fastify.post('/waitlist', {
    preHandler: [...managerAuth, validate({ body: addWaitlistSchema })],
  }, async (request) => {
    return reservationService.addToWaitlist(request.tenantId, request.body);
  });

  // Public waitlist join (validated)
  fastify.post('/public/waitlist/:slug', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    preHandler: [validate({ body: addWaitlistSchema })],
  }, async (request, reply) => {
    const tenant = await fastify.knex('tenants').where({ slug: request.params.slug, is_active: true }).first();
    if (!tenant) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Restaurant not found' });
    return reservationService.addToWaitlist(tenant.id, { ...request.body, date: new Date().toISOString().split('T')[0] });
  });

  // Get waitlist
  fastify.get('/waitlist', { preHandler: managerAuth }, async (request) => {
    return reservationService.getWaitlist(request.tenantId, request.query.date);
  });

  // Today's overview
  fastify.get('/reservations/today', { preHandler: managerAuth }, async (request) => {
    return reservationService.getTodayOverview(request.tenantId);
  });
}
