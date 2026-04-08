import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createCategorySchema, updateCategorySchema, reorderSchema,
  createItemSchema, updateItemSchema, menuQuerySchema,
} from './menu.schema.js';
import * as menuService from './menu.service.js';

export default async function menuRoutes(fastify) {
  const staffAuth = [authenticate, tenantContext, requireTenant];
  const managerAuth = [...staffAuth, authorize(['super_admin', 'owner', 'manager'])];

  // ── Categories ────────────────────────────────────────

  fastify.get('/menu/categories', {
    preHandler: staffAuth,
  }, async (request) => {
    return menuService.listCategories(request.tenantId);
  });

  fastify.post('/menu/categories', {
    preHandler: [...managerAuth, validate({ body: createCategorySchema })],
  }, async (request) => {
    return menuService.createCategory(request.tenantId, request.body);
  });

  fastify.put('/menu/categories/:id', {
    preHandler: [...managerAuth, validate({ body: updateCategorySchema })],
  }, async (request) => {
    return menuService.updateCategory(request.tenantId, request.params.id, request.body);
  });

  fastify.delete('/menu/categories/:id', {
    preHandler: managerAuth,
  }, async (request) => {
    await menuService.deleteCategory(request.tenantId, request.params.id);
    return { message: 'Category deleted' };
  });

  fastify.put('/menu/categories/reorder', {
    preHandler: [...managerAuth, validate({ body: reorderSchema })],
  }, async (request) => {
    await menuService.reorderCategories(request.tenantId, request.body.items);
    return { message: 'Categories reordered' };
  });

  // ── Menu Items ────────────────────────────────────────

  fastify.get('/menu/items', {
    preHandler: staffAuth,
  }, async (request) => {
    return menuService.listItems(request.tenantId, request.query);
  });

  fastify.get('/menu/items/:id', {
    preHandler: staffAuth,
  }, async (request) => {
    return menuService.getItem(request.tenantId, request.params.id);
  });

  fastify.post('/menu/items', {
    preHandler: [...managerAuth, validate({ body: createItemSchema })],
  }, async (request) => {
    return menuService.createItem(request.tenantId, request.body);
  });

  fastify.put('/menu/items/:id', {
    preHandler: [...managerAuth, validate({ body: updateItemSchema })],
  }, async (request) => {
    return menuService.updateItem(request.tenantId, request.params.id, request.body);
  });

  fastify.delete('/menu/items/:id', {
    preHandler: managerAuth,
  }, async (request) => {
    await menuService.deleteItem(request.tenantId, request.params.id);
    return { message: 'Menu item deleted' };
  });

  fastify.put('/menu/items/:id/availability', {
    preHandler: managerAuth,
  }, async (request) => {
    return menuService.toggleAvailability(request.tenantId, request.params.id);
  });

  fastify.put('/menu/items/reorder', {
    preHandler: [...managerAuth, validate({ body: reorderSchema })],
  }, async (request) => {
    await menuService.reorderItems(request.tenantId, request.body.items);
    return { message: 'Items reordered' };
  });

  // ── Public Menu ───────────────────────────────────────

  fastify.get('/public/menu/:slug', async (request) => {
    return menuService.getPublicMenu(request.params.slug);
  });

  fastify.get('/public/menu/:slug/search', async (request) => {
    const q = request.query.q || '';
    if (q.length < 2) return [];
    return menuService.searchPublicMenu(request.params.slug, q);
  });
}
