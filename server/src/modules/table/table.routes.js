import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { createTableSchema, updateTableSchema, updateStatusSchema } from './table.schema.js';
import * as tableService from './table.service.js';

export default async function tableRoutes(fastify) {
  const staffAuth = [authenticate, tenantContext, requireTenant];
  const managerAuth = [...staffAuth, authorize(['super_admin', 'owner', 'manager'])];

  fastify.get('/tables', {
    preHandler: staffAuth,
  }, async (request) => {
    return tableService.listTables(request.tenantId);
  });

  fastify.post('/tables', {
    preHandler: [...managerAuth, validate({ body: createTableSchema })],
  }, async (request) => {
    return tableService.createTable(request.tenantId, request.body);
  });

  fastify.put('/tables/:id', {
    preHandler: [...managerAuth, validate({ body: updateTableSchema })],
  }, async (request) => {
    return tableService.updateTable(request.tenantId, request.params.id, request.body);
  });

  fastify.delete('/tables/:id', {
    preHandler: managerAuth,
  }, async (request) => {
    await tableService.deleteTable(request.tenantId, request.params.id);
    return { message: 'Table deleted' };
  });

  fastify.put('/tables/:id/status', {
    preHandler: [...staffAuth, validate({ body: updateStatusSchema })],
  }, async (request) => {
    return tableService.updateStatus(request.tenantId, request.params.id, request.body.status);
  });

  fastify.get('/tables/:id/qr', {
    preHandler: managerAuth,
  }, async (request) => {
    return tableService.generateQR(request.tenantId, request.params.id);
  });

  fastify.post('/tables/:id/session/close', {
    preHandler: staffAuth,
  }, async (request) => {
    return tableService.closeSession(request.tenantId, request.params.id);
  });

  fastify.get('/tables/overview', {
    preHandler: staffAuth,
  }, async (request) => {
    return tableService.getTableOverview(request.tenantId);
  });
}
