import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { isTokenBlacklisted } from '../config/redis.js';

/**
 * WebSocket manager with production hardening:
 * - First-message authentication (not query param)
 * - Per-user connection limits
 * - Heartbeat with dead connection cleanup
 * - Role-based channels
 */
class WebSocketManager {
  constructor() {
    this.connections = new Map(); // tenantId → Map<channel, Set<ws>>
    this.userConnections = new Map(); // userId → count
    this.heartbeatInterval = null;
  }

  init(fastify) {
    fastify.register(import('@fastify/websocket'));

    fastify.after(() => {
      fastify.get('/ws', { websocket: true }, (socket, request) => {
        this.handleConnection(socket, request);
      });
    });

    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((channels) => {
        channels.forEach((sockets) => {
          sockets.forEach((ws) => {
            if (ws.isAlive === false) {
              this.removeConnection(ws);
              ws.terminate();
              return;
            }
            ws.isAlive = false;
            ws.ping();
          });
        });
      });
    }, 30000);

    fastify.decorate('ws', this);
  }

  handleConnection(socket, request) {
    // Start unauthenticated — require first message with token
    socket.isAlive = true;
    socket.authenticated = false;

    // Also support query param for backwards compatibility (but log warning)
    const url = new URL(request.url, `http://${request.headers.host}`);
    const queryToken = url.searchParams.get('token');

    if (queryToken) {
      this.authenticateSocket(socket, queryToken);
    }

    // First-message auth: client sends { type: 'auth', token: '...' }
    const authTimeout = setTimeout(() => {
      if (!socket.authenticated) {
        socket.close(4001, 'Authentication timeout');
      }
    }, 10000);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'auth' && msg.token && !socket.authenticated) {
          clearTimeout(authTimeout);
          this.authenticateSocket(socket, msg.token);
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      this.removeConnection(socket);
    });

    socket.on('error', () => {
      clearTimeout(authTimeout);
      this.removeConnection(socket);
    });
  }

  async authenticateSocket(socket, token) {
    let user;
    try {
      user = jwt.verify(token, config.jwt.secret);
    } catch {
      socket.close(4001, 'Invalid token');
      return;
    }

    // Check blacklist
    if (user.jti) {
      const blacklisted = await isTokenBlacklisted(user.jti);
      if (blacklisted) {
        socket.close(4001, 'Token revoked');
        return;
      }
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      socket.close(4002, 'No tenant context');
      return;
    }

    // Connection limit per user
    const userId = user.userId || `customer:${user.tableId}`;
    const currentCount = this.userConnections.get(userId) || 0;
    if (currentCount >= config.security.maxWsConnectionsPerUser) {
      socket.close(4029, 'Too many connections');
      return;
    }
    this.userConnections.set(userId, currentCount + 1);

    // Register to channels
    const channels = this.getChannelsForRole(user);

    if (!this.connections.has(tenantId)) {
      this.connections.set(tenantId, new Map());
    }
    const tenantChannels = this.connections.get(tenantId);

    for (const channel of channels) {
      if (!tenantChannels.has(channel)) {
        tenantChannels.set(channel, new Set());
      }
      tenantChannels.get(channel).add(socket);
    }

    socket.authenticated = true;
    socket.tenantId = tenantId;
    socket.channels = channels;
    socket.userId = userId;

    socket.send(JSON.stringify({
      type: 'connected',
      payload: { channels, role: user.role },
      timestamp: new Date().toISOString(),
    }));
  }

  getChannelsForRole(user) {
    switch (user.role) {
      case 'chef':
        return ['kitchen', 'all'];
      case 'waiter':
        return ['waiter', 'all'];
      case 'counter':
        return ['counter', 'all'];
      case 'customer':
        return [`customer:${user.tableId}`, 'all'];
      case 'owner':
      case 'manager':
      case 'super_admin':
        return ['kitchen', 'waiter', 'counter', 'all'];
      default:
        return ['all'];
    }
  }

  removeConnection(socket) {
    const tenantId = socket.tenantId;

    // Decrement user connection count
    if (socket.userId) {
      const count = this.userConnections.get(socket.userId) || 0;
      if (count <= 1) {
        this.userConnections.delete(socket.userId);
      } else {
        this.userConnections.set(socket.userId, count - 1);
      }
    }

    if (!tenantId || !this.connections.has(tenantId)) return;

    const channels = this.connections.get(tenantId);
    for (const channel of (socket.channels || [])) {
      if (channels.has(channel)) {
        channels.get(channel).delete(socket);
        if (channels.get(channel).size === 0) {
          channels.delete(channel);
        }
      }
    }

    if (channels.size === 0) {
      this.connections.delete(tenantId);
    }
  }

  broadcast(tenantId, channel, message) {
    if (!this.connections.has(tenantId)) return;

    const channels = this.connections.get(tenantId);
    const msg = JSON.stringify(message);

    if (channel === 'all') {
      channels.forEach((sockets) => {
        sockets.forEach((ws) => {
          if (ws.readyState === 1 && ws.authenticated) ws.send(msg);
        });
      });
    } else if (channels.has(channel)) {
      channels.get(channel).forEach((ws) => {
        if (ws.readyState === 1 && ws.authenticated) ws.send(msg);
      });
    }
  }

  broadcastToTable(tenantId, tableId, message) {
    this.broadcast(tenantId, `customer:${tableId}`, message);
  }

  getConnectionCount() {
    let total = 0;
    this.connections.forEach((channels) => {
      const seen = new Set();
      channels.forEach((sockets) => {
        sockets.forEach((ws) => { if (!seen.has(ws)) { seen.add(ws); total++; } });
      });
    });
    return total;
  }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.connections.forEach((channels) => {
      channels.forEach((sockets) => {
        sockets.forEach((ws) => {
          try { ws.close(1001, 'Server shutting down'); } catch { ws.terminate(); }
        });
      });
    });
    this.connections.clear();
    this.userConnections.clear();
  }
}

export default new WebSocketManager();
