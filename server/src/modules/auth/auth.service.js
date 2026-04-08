import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'crypto';
import db from '../../config/database.js';
import config from '../../config/index.js';
import {
  blacklistToken, recordLoginFailure, getLoginFailures,
  clearLoginFailures, cacheSet, cacheGet, cacheDel,
} from '../../config/redis.js';
import { UnauthorizedError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { logAudit } from '../audit/audit.service.js';

const BCRYPT_ROUNDS = 12;

async function generateTokens(user) {
  const jti = randomUUID();

  // Include businessType for conditional UI
  let businessType = 'restaurant';
  if (user.tenant_id) {
    const tenant = await db('tenants').where({ id: user.tenant_id }).select('business_type').first();
    businessType = tenant?.business_type || 'restaurant';
  }

  const payload = {
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    name: user.name,
    businessType,
    jti,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry,
  });

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh', jti: randomUUID() },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );

  return { accessToken, refreshToken, jti };
}

export async function login(email, password, ipAddress = null) {
  // Check lockout
  const failures = await getLoginFailures(email);
  if (failures >= config.security.maxLoginAttempts) {
    throw new UnauthorizedError(
      `Account temporarily locked. Try again in ${config.security.lockoutMinutes} minutes.`
    );
  }

  const user = await db('users')
    .where({ email, is_active: true })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    await recordLoginFailure(email);
    throw new UnauthorizedError('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    const count = await recordLoginFailure(email);
    const remaining = config.security.maxLoginAttempts - count;
    if (remaining <= 0) {
      throw new UnauthorizedError(
        `Account locked after too many failed attempts. Try again in ${config.security.lockoutMinutes} minutes.`
      );
    }
    throw new UnauthorizedError('Invalid email or password');
  }

  // Successful login — clear failures
  await clearLoginFailures(email);

  const tokens = await generateTokens(user);

  await db('users').where({ id: user.id }).update({
    refresh_token: tokens.refreshToken,
    last_login: db.fn.now(),
  });

  await logAudit({
    tenantId: user.tenant_id,
    userId: user.id,
    action: 'login',
    entity: 'user',
    entityId: user.id,
    ipAddress,
  });

  // Get business type for frontend conditional UI
  let businessType = 'restaurant';
  if (user.tenant_id) {
    const t = await db('tenants').where({ id: user.tenant_id }).select('business_type').first();
    businessType = t?.business_type || 'restaurant';
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      businessType,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function register({ name, email, password, phone, role, tenantId }) {
  const existing = await db('users')
    .where({ email, tenant_id: tenantId || null })
    .whereNull('deleted_at')
    .first();

  if (existing) {
    throw new ConflictError('A user with this email already exists in this restaurant');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db('users')
    .insert({
      name,
      email,
      password_hash: passwordHash,
      phone,
      role,
      tenant_id: tenantId || null,
    })
    .returning(['id', 'name', 'email', 'role', 'tenant_id']);

  await logAudit({
    tenantId,
    userId: user.id,
    action: 'user_created',
    entity: 'user',
    entityId: user.id,
    newValue: { name, email, role },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenant_id,
  };
}

export async function refreshTokens(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const user = await db('users')
    .where({ id: decoded.userId, refresh_token: refreshToken, is_active: true })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    // Possible token reuse — blacklist the old token's user's sessions
    await logAudit({
      userId: decoded.userId,
      action: 'refresh_token_reuse_detected',
      entity: 'user',
      entityId: decoded.userId,
    });
    throw new UnauthorizedError('Invalid refresh token — possible reuse detected');
  }

  const tokens = await generateTokens(user);

  await db('users').where({ id: user.id }).update({
    refresh_token: tokens.refreshToken,
  });

  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

export async function logout(userId, jti = null) {
  await db('users').where({ id: userId }).update({ refresh_token: null });

  // Blacklist current access token until it expires
  if (jti) {
    // Parse JWT expiry to get remaining TTL
    const ttl = 15 * 60; // 15 minutes max (access token expiry)
    await blacklistToken(jti, ttl);
  }

  await logAudit({ userId, action: 'logout', entity: 'user', entityId: userId });
}

export async function getProfile(userId) {
  const user = await db('users')
    .select('id', 'name', 'email', 'phone', 'role', 'tenant_id', 'last_login', 'created_at')
    .where({ id: userId })
    .whereNull('deleted_at')
    .first();

  if (!user) throw new NotFoundError('User');
  return user;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new NotFoundError('User');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw new ValidationError('Current password is incorrect');
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db('users').where({ id: userId }).update({ password_hash: hash, refresh_token: null });

  await logAudit({ userId, action: 'password_changed', entity: 'user', entityId: userId });
}

// ── Password Reset Flow ─────────────────────────────────

export async function requestPasswordReset(email) {
  const user = await db('users')
    .where({ email, is_active: true })
    .whereNull('deleted_at')
    .first();

  // Always return success to prevent email enumeration
  if (!user) return { message: 'If that email exists, a reset link has been sent.' };

  const resetToken = randomBytes(32).toString('hex');
  const expiresAt = config.security.passwordResetExpiryMinutes * 60;

  // Store token in Redis with TTL
  await cacheSet(`pwreset:${resetToken}`, { userId: user.id, email }, expiresAt);

  await logAudit({
    tenantId: user.tenant_id,
    userId: user.id,
    action: 'password_reset_requested',
    entity: 'user',
    entityId: user.id,
  });

  // In production, send email here. For now, log the token in dev.
  if (!config.isProduction) {
    console.log(`\n🔑 Password reset token for ${email}: ${resetToken}\n`);
  }

  return { message: 'If that email exists, a reset link has been sent.', ...(config.isProduction ? {} : { resetToken }) };
}

export async function resetPassword(resetToken, newPassword) {
  const cached = await cacheGet(`pwreset:${resetToken}`);
  if (!cached) {
    throw new ValidationError('Invalid or expired reset token');
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const result = await db('users')
    .where({ id: cached.userId })
    .update({ password_hash: hash, refresh_token: null });

  if (!result) throw new NotFoundError('User');

  // Invalidate the token
  await cacheDel(`pwreset:${resetToken}`);

  await logAudit({
    userId: cached.userId,
    action: 'password_reset_completed',
    entity: 'user',
    entityId: cached.userId,
  });

  return { message: 'Password reset successful. Please log in with your new password.' };
}

// ── Customer Session ────────────────────────────────────

export async function createCustomerSession(tenantId, tableId) {
  const tenant = await db('tenants')
    .where({ id: tenantId, is_active: true })
    .whereNull('deleted_at')
    .first();
  if (!tenant) throw new NotFoundError('Restaurant');

  const table = await db('tables')
    .where({ id: tableId, tenant_id: tenantId, is_active: true })
    .whereNull('deleted_at')
    .first();
  if (!table) throw new NotFoundError('Table');

  // Check for existing active session
  let session = await db('table_sessions')
    .where({ table_id: tableId, tenant_id: tenantId, status: 'active' })
    .first();

  if (!session) {
    const sessionToken = jwt.sign(
      { type: 'customer_session' },
      config.jwt.secret,
      { expiresIn: '4h' }
    );

    [session] = await db('table_sessions')
      .insert({
        tenant_id: tenantId,
        table_id: tableId,
        session_token: sessionToken,
        status: 'active',
      })
      .returning('*');

    await db('tables').where({ id: tableId }).update({ status: 'occupied' });
  }

  const token = jwt.sign(
    {
      tenantId,
      tableId,
      sessionId: session.id,
      role: 'customer',
      tableNumber: table.table_number,
      jti: randomUUID(),
    },
    config.jwt.secret,
    { expiresIn: '4h' }
  );

  return {
    token,
    session: {
      id: session.id,
      tableNumber: table.table_number,
      tableLabel: table.label,
      restaurantName: tenant.name,
    },
  };
}
