import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { createComboSchema, updateComboSchema } from './combo.schema.js';
import * as comboService from './combo.service.js';

export default async function comboRoutes(fastify) {
  const managerAuth = [authenticate, tenantContext, requireTenant, authorize(['super_admin', 'owner', 'manager'])];

  fastify.get('/combos', {
    preHandler: [authenticate, tenantContext, requireTenant],
  }, async (request) => {
    return comboService.listCombos(request.tenantId);
  });

  fastify.post('/combos', {
    preHandler: [...managerAuth, validate({ body: createComboSchema })],
  }, async (request) => {
    return comboService.createCombo(request.tenantId, request.body);
  });

  fastify.put('/combos/:id', {
    preHandler: [...managerAuth, validate({ body: updateComboSchema })],
  }, async (request) => {
    return comboService.updateCombo(request.tenantId, request.params.id, request.body);
  });

  fastify.delete('/combos/:id', { preHandler: managerAuth }, async (request) => {
    await comboService.deleteCombo(request.tenantId, request.params.id);
    return { message: 'Combo deleted' };
  });
}
