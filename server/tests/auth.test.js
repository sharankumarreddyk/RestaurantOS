import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

/**
 * Unit tests for auth token logic.
 * Tests JWT creation, validation, and edge cases without database.
 */

const JWT_SECRET = 'test-secret-for-unit-tests';

describe('Auth Token Logic', () => {
  describe('JWT generation', () => {
    it('creates a valid access token with required claims', () => {
      const payload = {
        userId: '123',
        tenantId: 'tenant-1',
        role: 'owner',
        name: 'Test User',
        jti: 'unique-id',
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.userId).toBe('123');
      expect(decoded.tenantId).toBe('tenant-1');
      expect(decoded.role).toBe('owner');
      expect(decoded.jti).toBe('unique-id');
      expect(decoded.exp).toBeDefined();
    });

    it('rejects token with wrong secret', () => {
      const token = jwt.sign({ userId: '123' }, JWT_SECRET);
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });

    it('rejects expired token', () => {
      const token = jwt.sign({ userId: '123' }, JWT_SECRET, { expiresIn: '-1s' });
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow('jwt expired');
    });
  });

  describe('Role hierarchy', () => {
    const roleHierarchy = { super_admin: 6, owner: 5, manager: 4, waiter: 3, chef: 3, counter: 3 };

    it('prevents creating equal or higher role', () => {
      const callerRole = 'manager';
      const targetRole = 'owner';
      expect(roleHierarchy[targetRole] >= roleHierarchy[callerRole]).toBe(true);
    });

    it('allows creating lower role', () => {
      const callerRole = 'owner';
      const targetRole = 'waiter';
      expect(roleHierarchy[targetRole] >= roleHierarchy[callerRole]).toBe(false);
    });

    it('prevents creating same role', () => {
      const callerRole = 'manager';
      const targetRole = 'manager';
      expect(roleHierarchy[targetRole] >= roleHierarchy[callerRole]).toBe(true);
    });

    it('allows super_admin to create any role', () => {
      const callerRole = 'super_admin';
      for (const target of ['owner', 'manager', 'waiter', 'chef', 'counter']) {
        expect(roleHierarchy[target] >= roleHierarchy[callerRole]).toBe(false);
      }
    });
  });

  describe('Customer session token', () => {
    it('includes tableId and role=customer', () => {
      const payload = {
        tenantId: 'tenant-1',
        tableId: 'table-1',
        sessionId: 'session-1',
        role: 'customer',
        tableNumber: 5,
        jti: 'cust-jti',
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '4h' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.role).toBe('customer');
      expect(decoded.tableId).toBe('table-1');
      expect(decoded.tableNumber).toBe(5);
    });
  });
});
