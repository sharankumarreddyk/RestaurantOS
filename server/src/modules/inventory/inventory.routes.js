import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import { createInventoryItemSchema, updateStockSchema, linkIngredientSchema } from './inventory.schema.js';
import * as inventoryService from './inventory.service.js';

export default async function inventoryRoutes(fastify) {
  const managerAuth = [authenticate, tenantContext, requireTenant, authorize(['super_admin', 'owner', 'manager'])];

  fastify.get('/inventory', { preHandler: managerAuth }, async (request) => {
    return inventoryService.listInventory(request.tenantId, request.query);
  });

  fastify.post('/inventory', {
    preHandler: [...managerAuth, validate({ body: createInventoryItemSchema })],
  }, async (request) => {
    return inventoryService.createItem(request.tenantId, request.body);
  });

  fastify.put('/inventory/:id/stock', {
    preHandler: [...managerAuth, validate({ body: updateStockSchema })],
  }, async (request) => {
    return inventoryService.updateStock(request.tenantId, request.params.id, {
      changeAmount: request.body.changeAmount,
      reason: request.body.reason,
      userId: request.user.userId,
    });
  });

  fastify.get('/inventory/low-stock', { preHandler: managerAuth }, async (request) => {
    return inventoryService.getLowStockAlerts(request.tenantId);
  });

  fastify.post('/inventory/link-ingredient', {
    preHandler: [...managerAuth, validate({ body: linkIngredientSchema })],
  }, async (request) => {
    return inventoryService.linkIngredient(
      request.body.menuItemId, request.body.inventoryItemId, request.body.quantityNeeded
    );
  });

  fastify.get('/inventory/ingredients/:menuItemId', { preHandler: managerAuth }, async (request) => {
    return inventoryService.getItemIngredients(request.params.menuItemId);
  });
}
