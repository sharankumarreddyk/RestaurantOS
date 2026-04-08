import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { applyDiscountSchema, recordPaymentSchema, serviceChargeSchema, addTipSchema } from './billing.schema.js';
import * as billingService from './billing.service.js';

export default async function billingRoutes(fastify) {
  const staffAuth = [authenticate, tenantContext, requireTenant];

  fastify.get('/bills/table/:tableId', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    return billingService.getBillForTable(tenantId, request.params.tableId);
  });

  fastify.get('/bills/:id', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    return billingService.getBill(tenantId, request.params.id);
  });

  fastify.put('/bills/:id/discount', {
    preHandler: [
      ...staffAuth,
      authorize(['super_admin', 'owner', 'manager', 'counter', 'cafe_operator']),
      validate({ body: applyDiscountSchema }),
    ],
  }, async (request) => {
    return billingService.applyDiscount(request.tenantId, request.params.id, request.body);
  });

  fastify.put('/bills/:id/service-charge', {
    preHandler: [
      ...staffAuth,
      authorize(['super_admin', 'owner', 'manager', 'counter', 'cafe_operator']),
      validate({ body: serviceChargeSchema }),
    ],
  }, async (request) => {
    return billingService.setServiceCharge(request.tenantId, request.params.id, request.body.percent);
  });

  fastify.post('/bills/:id/payment', {
    preHandler: [
      ...staffAuth,
      authorize(['super_admin', 'owner', 'manager', 'counter', 'cafe_operator']),
      validate({ body: recordPaymentSchema }),
    ],
  }, async (request) => {
    const payment = await billingService.recordPayment(
      request.tenantId, request.params.id, request.body, request.user.userId
    );

    if (fastify.ws) {
      fastify.ws.broadcast(request.tenantId, 'counter', {
        type: 'bill:updated',
        payload: { billId: request.params.id },
        timestamp: new Date().toISOString(),
      });
    }

    return payment;
  });

  fastify.put('/bills/:id/close', {
    preHandler: [...staffAuth, authorize(['super_admin', 'owner', 'manager', 'counter', 'cafe_operator'])],
  }, async (request) => {
    return billingService.closeBill(request.tenantId, request.params.id);
  });

  fastify.get('/bills/:id/print', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    return billingService.getPrintBill(tenantId, request.params.id);
  });

  fastify.get('/bills', {
    preHandler: staffAuth,
  }, async (request) => {
    return billingService.listBills(request.tenantId, request.query);
  });

  // Add tip to bill
  fastify.put('/bills/:id/tip', {
    preHandler: [authenticate, tenantContext, validate({ body: addTipSchema })],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    return billingService.addTip(tenantId, request.params.id, request.body.amount);
  });

  // HTML receipt (for digital sharing / print-friendly)
  fastify.get('/bills/:id/receipt', {
    preHandler: [authenticate, tenantContext],
  }, async (request, reply) => {
    const tenantId = request.tenantId || request.user.tenantId;
    const html = await billingService.getHtmlReceipt(tenantId, request.params.id);
    reply.header('Content-Type', 'text/html').send(html);
  });

  // Quick close table (cafe mode — one-tap close)
  fastify.post('/bills/quick-close/:tableId', {
    preHandler: [authenticate, tenantContext],
  }, async (request) => {
    const tenantId = request.tenantId || request.user.tenantId;
    return billingService.quickCloseTable(tenantId, request.params.tableId);
  });
}
