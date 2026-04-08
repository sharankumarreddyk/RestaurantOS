import { randomUUID } from 'crypto';

/**
 * Adds X-Request-Id to every request/response for tracing.
 * Uses client-provided header if present, otherwise generates one.
 */
export function requestIdHook(request, reply, done) {
  const requestId = request.headers['x-request-id'] || randomUUID();
  request.requestId = requestId;
  reply.header('X-Request-Id', requestId);
  done();
}
