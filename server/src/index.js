import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import db from './config/database.js';
import { getRedis, setLogger } from './config/redis.js';
import wsManager from './realtime/websocket.js';
import { requestIdHook } from './middleware/requestId.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import tenantRoutes from './modules/tenant/tenant.routes.js';
import menuRoutes from './modules/menu/menu.routes.js';
import tableRoutes from './modules/table/table.routes.js';
import orderRoutes from './modules/order/order.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import notificationRoutes from './modules/notification/notification.routes.js';
import feedbackRoutes from './modules/feedback/feedback.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import reservationRoutes from './modules/reservation/reservation.routes.js';
import comboRoutes from './modules/combo/combo.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger: {
    level: config.isProduction ? 'warn' : 'info',
    transport: !config.isProduction ? { target: 'pino-pretty' } : undefined,
  },
  trustProxy: true,
  bodyLimit: config.security.requestBodyLimit,
  requestTimeout: 30000,
});

// Share fastify logger with Redis module
setLogger(fastify.log);

// ── Security Headers (Helmet) ───────────────────────────

await fastify.register(helmet, {
  contentSecurityPolicy: config.isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// ── Compression ─────────────────────────────────────────

await fastify.register(compress, { global: true });

// ── CORS ────────────────────────────────────────────────

await fastify.register(cors, {
  origin: config.baseUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Tenant-Id', 'X-CSRF-Token'],
});

// ── Cookie ──────────────────────────────────────────────

await fastify.register(cookie, {
  secret: config.jwt.secret,
});

// ── CSRF Protection ─────────────────────────────────────
// CSRF token generation on auth, validation on state-changing requests

await fastify.register(import('@fastify/csrf-protection'), {
  sessionPlugin: '@fastify/cookie',
  cookieOpts: {
    signed: true,
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
  },
  getToken: (request) => request.headers['x-csrf-token'],
});

// ── Multipart ───────────────────────────────────────────

await fastify.register(multipart, {
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
    fieldSize: 1024 * 100, // 100KB for form fields
  },
});

// ── Rate Limiting ───────────────────────────────────────

await fastify.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.user?.userId || request.ip,
});

// ── Static Files ────────────────────────────────────────

await fastify.register(fastifyStatic, {
  root: path.resolve(config.upload.dir),
  prefix: '/uploads/',
  decorateReply: false,
});

const clientBuild = path.resolve(__dirname, '../../client/dist');
await fastify.register(fastifyStatic, {
  root: clientBuild,
  prefix: '/',
  wildcard: false,
  decorateReply: false,
});

// ── Request ID Tracing ──────────────────────────────────

fastify.addHook('onRequest', requestIdHook);

// Request logging for non-production
fastify.addHook('onResponse', (request, reply, done) => {
  if (!config.isProduction) {
    request.log.info({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    });
  }
  done();
});

// Decorate with knex for direct access in routes
fastify.decorate('knex', db);

// ── WebSocket ───────────────────────────────────────────
wsManager.init(fastify);

// ── CSRF Token Endpoint ─────────────────────────────────
fastify.get('/api/csrf-token', async (request, reply) => {
  const token = reply.generateCsrf();
  return { csrfToken: token };
});

// ── API Routes ──────────────────────────────────────────

fastify.register(authRoutes, { prefix: '/api' });
fastify.register(tenantRoutes, { prefix: '/api' });
fastify.register(menuRoutes, { prefix: '/api' });
fastify.register(tableRoutes, { prefix: '/api' });
fastify.register(orderRoutes, { prefix: '/api' });
fastify.register(billingRoutes, { prefix: '/api' });
fastify.register(analyticsRoutes, { prefix: '/api' });
fastify.register(uploadRoutes, { prefix: '/api' });
fastify.register(adminRoutes, { prefix: '/api' });
fastify.register(notificationRoutes, { prefix: '/api' });
fastify.register(feedbackRoutes, { prefix: '/api' });
fastify.register(inventoryRoutes, { prefix: '/api' });
fastify.register(reservationRoutes, { prefix: '/api' });
fastify.register(comboRoutes, { prefix: '/api' });

// ── Health Checks ───────────────────────────────────────

// Liveness: can the process respond?
fastify.get('/api/health/live', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Readiness: can the process serve traffic?
fastify.get('/api/health', async (request, reply) => {
  const dbOk = await db.raw('SELECT 1').then(() => true).catch(() => false);
  const redis = await getRedis();
  const redisOk = redis ? await redis.ping().then(() => true).catch(() => false) : false;

  const healthy = dbOk; // DB is required, Redis is optional
  const status = {
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'unavailable',
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };

  reply.code(healthy ? 200 : 503).send(status);
});

// ── Metrics (basic) ─────────────────────────────────────

let requestCount = 0;
let errorCount = 0;

fastify.addHook('onRequest', (request, reply, done) => {
  requestCount++;
  done();
});

fastify.get('/api/metrics', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async () => ({
  requests: requestCount,
  errors: errorCount,
  uptime: process.uptime(),
  memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  connections: wsManager.getConnectionCount?.() || 0,
}));

// ── SPA Fallback ────────────────────────────────────────

fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api/')) {
    reply.code(404).send({ error: 'NOT_FOUND', message: 'Endpoint not found' });
  } else {
    reply.sendFile('index.html', clientBuild);
  }
});

// ── Error Handler ───────────────────────────────────────

fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    errorCount++;
    request.log.error({
      err: error,
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      userId: request.user?.userId,
      tenantId: request.tenantId,
    });
  }

  reply.code(statusCode).send({
    error: error.code || 'INTERNAL_ERROR',
    message: statusCode >= 500 && config.isProduction
      ? 'Internal server error'
      : error.message,
    ...(error.details && !config.isProduction ? { details: error.details } : {}),
    requestId: request.requestId,
  });
});

// ── Start ───────────────────────────────────────────────

const start = async () => {
  try {
    // Test DB with retries
    let dbConnected = false;
    for (let i = 0; i < 5; i++) {
      try {
        await db.raw('SELECT 1');
        dbConnected = true;
        break;
      } catch (err) {
        fastify.log.warn(`DB connection attempt ${i + 1}/5 failed: ${err.message}`);
        if (i < 4) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (!dbConnected) throw new Error('Database connection failed after 5 attempts');
    fastify.log.info('Database connected');

    // Connect Redis (non-blocking)
    await getRedis();

    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Server running on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// ── Graceful Shutdown ───────────────────────────────────

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  fastify.log.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  // Give in-flight requests 30s to complete
  const drainTimeout = setTimeout(() => {
    fastify.log.warn('Drain timeout reached, forcing shutdown');
    process.exit(1);
  }, 30000);

  try {
    wsManager.destroy();
    await fastify.close();
    const redis = await getRedis();
    if (redis) await redis.quit().catch(() => {});
    await db.destroy();
    clearTimeout(drainTimeout);
    fastify.log.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    clearTimeout(drainTimeout);
    fastify.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  fastify.log.error(err, 'Unhandled rejection');
});

start();
