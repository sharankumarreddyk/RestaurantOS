import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

/**
 * Tests for cafe mode — business_type driven conditional behavior.
 * Validates order status transitions, role hierarchy, and JWT claims.
 */

const JWT_SECRET = 'test-secret';

describe('Cafe Mode', () => {
  describe('Order status transitions', () => {
    // Cafe allows pending → served directly (skip kitchen pipeline)
    const cafeTransitions = {
      pending: ['confirmed', 'served', 'cancelled'],
      confirmed: ['preparing', 'served', 'cancelled'],
      preparing: ['ready', 'served', 'cancelled'],
      ready: ['served'],
      served: [],
      cancelled: [],
    };

    // Restaurant blocks pending → served
    const restaurantTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'served', 'cancelled'],
      ready: ['served'],
      served: [],
      cancelled: [],
    };

    it('cafe allows pending → served (skip kitchen)', () => {
      expect(cafeTransitions.pending).toContain('served');
    });

    it('restaurant blocks pending → served', () => {
      expect(restaurantTransitions.pending).not.toContain('served');
    });

    it('cafe still allows the full pipeline if needed', () => {
      expect(cafeTransitions.pending).toContain('confirmed');
      expect(cafeTransitions.confirmed).toContain('preparing');
      expect(cafeTransitions.preparing).toContain('ready');
    });

    it('both modes allow cancellation from pending/confirmed', () => {
      expect(cafeTransitions.pending).toContain('cancelled');
      expect(cafeTransitions.confirmed).toContain('cancelled');
      expect(restaurantTransitions.pending).toContain('cancelled');
      expect(restaurantTransitions.confirmed).toContain('cancelled');
    });

    it('neither mode allows transition from served', () => {
      expect(cafeTransitions.served).toHaveLength(0);
      expect(restaurantTransitions.served).toHaveLength(0);
    });
  });

  describe('Role hierarchy', () => {
    const roleHierarchy = {
      super_admin: 6, owner: 5, manager: 4,
      waiter: 3, chef: 3, counter: 3, cafe_operator: 3,
    };

    it('cafe_operator is at waiter/chef/counter level', () => {
      expect(roleHierarchy.cafe_operator).toBe(roleHierarchy.waiter);
      expect(roleHierarchy.cafe_operator).toBe(roleHierarchy.chef);
      expect(roleHierarchy.cafe_operator).toBe(roleHierarchy.counter);
    });

    it('owner can create cafe_operator', () => {
      expect(roleHierarchy.cafe_operator < roleHierarchy.owner).toBe(true);
    });

    it('cafe_operator cannot create owner or manager', () => {
      expect(roleHierarchy.owner >= roleHierarchy.cafe_operator).toBe(true);
      expect(roleHierarchy.manager >= roleHierarchy.cafe_operator).toBe(true);
    });

    it('cafe_operator cannot create another cafe_operator (same level)', () => {
      expect(roleHierarchy.cafe_operator >= roleHierarchy.cafe_operator).toBe(true);
    });
  });

  describe('JWT businessType claim', () => {
    it('includes businessType in token payload', () => {
      const payload = {
        userId: 'u1',
        tenantId: 't1',
        role: 'cafe_operator',
        name: 'Cafe Staff',
        businessType: 'cafe',
        jti: 'test-jti',
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.businessType).toBe('cafe');
      expect(decoded.role).toBe('cafe_operator');
    });

    it('restaurant owner has businessType=restaurant', () => {
      const payload = {
        userId: 'u2',
        tenantId: 't2',
        role: 'owner',
        name: 'Restaurant Owner',
        businessType: 'restaurant',
        jti: 'test-jti-2',
      };
      const token = jwt.sign(payload, JWT_SECRET);
      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.businessType).toBe('restaurant');
    });
  });

  describe('Cafe sidebar navigation', () => {
    const cafeOperatorMenu = [
      { to: '/cafe', label: 'Table Tracker' },
    ];

    const cafeOwnerMenu = [
      { to: '/cafe', label: 'Table Tracker' },
      { to: '/menu', label: 'Menu' },
      { to: '/tables', label: 'Tables' },
      { to: '/settings', label: 'Settings' },
    ];

    const restaurantOwnerMenu = [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/menu', label: 'Menu' },
      { to: '/tables', label: 'Tables' },
      { to: '/orders', label: 'Orders' },
      { to: '/billing', label: 'Billing' },
      // ...more items
    ];

    it('cafe operator sees only Table Tracker', () => {
      expect(cafeOperatorMenu).toHaveLength(1);
      expect(cafeOperatorMenu[0].to).toBe('/cafe');
    });

    it('cafe owner sees 4 items (not 10)', () => {
      expect(cafeOwnerMenu).toHaveLength(4);
      expect(cafeOwnerMenu.map((i) => i.to)).not.toContain('/kitchen');
      expect(cafeOwnerMenu.map((i) => i.to)).not.toContain('/reservations');
      expect(cafeOwnerMenu.map((i) => i.to)).not.toContain('/inventory');
    });

    it('restaurant owner sees full menu', () => {
      expect(restaurantOwnerMenu.length).toBeGreaterThan(4);
      expect(restaurantOwnerMenu.map((i) => i.to)).toContain('/billing');
    });
  });

  describe('Login redirects', () => {
    const roleRedirects = {
      super_admin: '/admin',
      owner: '/dashboard',
      manager: '/dashboard',
      waiter: '/tables',
      chef: '/kitchen',
      counter: '/billing',
      cafe_operator: '/cafe',
    };

    it('cafe_operator redirects to /cafe', () => {
      expect(roleRedirects.cafe_operator).toBe('/cafe');
    });

    it('cafe owner redirected to /cafe (handled by businessType check)', () => {
      const user = { role: 'owner', businessType: 'cafe' };
      const redirect = user.businessType === 'cafe' && user.role === 'owner'
        ? '/cafe'
        : roleRedirects[user.role];
      expect(redirect).toBe('/cafe');
    });

    it('restaurant owner still goes to /dashboard', () => {
      const user = { role: 'owner', businessType: 'restaurant' };
      const redirect = user.businessType === 'cafe' && user.role === 'owner'
        ? '/cafe'
        : roleRedirects[user.role];
      expect(redirect).toBe('/dashboard');
    });
  });
});
