import { createClient } from 'redis';
import config from './index.js';

let redisClient = null;
let logger = console;

export function setLogger(l) { logger = l; }

export async function getRedis() {
  if (redisClient && redisClient.isOpen) return redisClient;

  redisClient = createClient({ url: config.redis.url });

  redisClient.on('error', (err) => {
    logger.error?.({ err: err.message }, 'Redis connection error');
  });

  try {
    await redisClient.connect();
    logger.info?.('Redis connected');
  } catch (err) {
    logger.warn?.({ err: err.message }, 'Redis unavailable, running without cache');
    redisClient = null;
  }

  return redisClient;
}

export async function cacheGet(key) {
  const client = await getRedis();
  if (!client) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  const client = await getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // non-fatal
  }
}

export async function cacheDel(pattern) {
  const client = await getRedis();
  if (!client) return;
  try {
    if (pattern.includes('*')) {
      // Use SCAN instead of KEYS to avoid blocking Redis
      let cursor = 0;
      do {
        const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        if (result.keys.length > 0) await client.del(result.keys);
      } while (cursor !== 0);
    } else {
      await client.del(pattern);
    }
  } catch {
    // non-fatal
  }
}

// ── Token Blacklist ─────────────────────────────────────

export async function blacklistToken(jti, ttlSeconds) {
  const client = await getRedis();
  if (!client) return;
  try {
    await client.set(`bl:${jti}`, '1', { EX: ttlSeconds });
  } catch {
    // If blacklist fails, token stays valid until expiry — acceptable tradeoff
  }
}

export async function isTokenBlacklisted(jti) {
  const client = await getRedis();
  if (!client) return false;
  try {
    const val = await client.get(`bl:${jti}`);
    return val !== null;
  } catch {
    return false;
  }
}

// ── Login Lockout ───────────────────────────────────────

export async function recordLoginFailure(email) {
  const client = await getRedis();
  if (!client) return 0;
  const key = `lockout:${email}`;
  try {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, config.security.lockoutMinutes * 60);
    return count;
  } catch {
    return 0;
  }
}

export async function getLoginFailures(email) {
  const client = await getRedis();
  if (!client) return 0;
  try {
    const val = await client.get(`lockout:${email}`);
    return parseInt(val || '0', 10);
  } catch {
    return 0;
  }
}

export async function clearLoginFailures(email) {
  const client = await getRedis();
  if (!client) return;
  try {
    await client.del(`lockout:${email}`);
  } catch {
    // non-fatal
  }
}

export default { getRedis, cacheGet, cacheSet, cacheDel, blacklistToken, isTokenBlacklisted };
