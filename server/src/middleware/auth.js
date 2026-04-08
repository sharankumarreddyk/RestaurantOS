import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { isTokenBlacklisted } from '../config/redis.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    // Check if token has been blacklisted (logout)
    if (decoded.jti) {
      const blacklisted = await isTokenBlacklisted(decoded.jti);
      if (blacklisted) {
        throw new UnauthorizedError('Token has been revoked');
      }
    }

    request.user = decoded;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

export function authorize(allowedRoles) {
  return function (request, reply, done) {
    if (!request.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(`Role '${request.user.role}' is not authorized for this action`);
    }
    done();
  };
}

export async function optionalAuth(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.jti) {
      const blacklisted = await isTokenBlacklisted(decoded.jti);
      if (blacklisted) return;
    }
    request.user = decoded;
  } catch {
    // Invalid token in optional auth — treat as unauthenticated
  }
}
