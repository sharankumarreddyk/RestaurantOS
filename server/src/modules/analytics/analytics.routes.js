import { authenticate, authorize } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import * as analyticsService from './analytics.service.js';
import * as advancedAnalytics from './analytics.advanced.js';

export default async function analyticsRoutes(fastify) {
  const authHooks = [
    authenticate, tenantContext, requireTenant,
    authorize(['super_admin', 'owner', 'manager']),
  ];

  fastify.get('/analytics/revenue', {
    preHandler: authHooks,
  }, async (request) => {
    return analyticsService.getRevenue(request.tenantId, request.query);
  });

  fastify.get('/analytics/orders', {
    preHandler: authHooks,
  }, async (request) => {
    return analyticsService.getOrderStats(request.tenantId, request.query);
  });

  fastify.get('/analytics/popular-items', {
    preHandler: authHooks,
  }, async (request) => {
    const limit = parseInt(request.query.limit, 10) || 10;
    return analyticsService.getPopularItems(request.tenantId, { ...request.query, limit });
  });

  fastify.get('/analytics/category-sales', {
    preHandler: authHooks,
  }, async (request) => {
    return analyticsService.getCategorySales(request.tenantId, request.query);
  });

  fastify.get('/analytics/dashboard', {
    preHandler: authHooks,
  }, async (request) => {
    return analyticsService.getDashboard(request.tenantId);
  });

  // ── Advanced Analytics ──────────────────────────────────

  fastify.get('/analytics/profitability', {
    preHandler: authHooks,
  }, async (request) => {
    return advancedAnalytics.getItemProfitability(request.tenantId, request.query);
  });

  fastify.get('/analytics/heatmap', {
    preHandler: authHooks,
  }, async (request) => {
    return advancedAnalytics.getPeakHoursHeatmap(request.tenantId, request.query);
  });

  fastify.get('/analytics/table-turnover', {
    preHandler: authHooks,
  }, async (request) => {
    return advancedAnalytics.getTableTurnoverStats(request.tenantId, request.query);
  });

  fastify.get('/analytics/feedback-trend', {
    preHandler: authHooks,
  }, async (request) => {
    return advancedAnalytics.getFeedbackTrend(request.tenantId, request.query);
  });
}
