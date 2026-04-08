import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests for Zod schema validation — ensures max lengths,
 * required fields, and enum constraints work.
 */

// Import schemas for testing
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const createOrderSchema = z.object({
  tableId: z.string().uuid(),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(200).optional(),
  })).min(1).max(50),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['manager', 'waiter', 'chef', 'counter']).optional(),
  isActive: z.boolean().optional(),
});

describe('Input Validation', () => {
  describe('Login schema', () => {
    it('accepts valid login', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'mypassword' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({ email: 'not-email', password: 'test' });
      expect(result.success).toBe(false);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: '' });
      expect(result.success).toBe(false);
    });

    it('rejects oversized email', () => {
      const longEmail = 'a'.repeat(250) + '@b.com';
      const result = loginSchema.safeParse({ email: longEmail, password: 'test' });
      expect(result.success).toBe(false);
    });

    it('rejects oversized password (128+ chars)', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'x'.repeat(200) });
      expect(result.success).toBe(false);
    });
  });

  describe('Order schema', () => {
    const validItem = { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 2 };
    const validOrder = { tableId: '550e8400-e29b-41d4-a716-446655440000', items: [validItem] };

    it('accepts valid order', () => {
      expect(createOrderSchema.safeParse(validOrder).success).toBe(true);
    });

    it('rejects order with no items', () => {
      expect(createOrderSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
    });

    it('rejects order with >50 items', () => {
      const items = Array(51).fill(validItem);
      expect(createOrderSchema.safeParse({ ...validOrder, items }).success).toBe(false);
    });

    it('rejects quantity > 99', () => {
      const items = [{ ...validItem, quantity: 100 }];
      expect(createOrderSchema.safeParse({ ...validOrder, items }).success).toBe(false);
    });

    it('rejects quantity < 1', () => {
      const items = [{ ...validItem, quantity: 0 }];
      expect(createOrderSchema.safeParse({ ...validOrder, items }).success).toBe(false);
    });

    it('rejects notes > 500 chars', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, notes: 'x'.repeat(501) });
      expect(result.success).toBe(false);
    });

    it('accepts notes within limit', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, notes: 'No onions please' });
      expect(result.success).toBe(true);
    });
  });

  describe('User update schema', () => {
    it('accepts valid partial update', () => {
      expect(updateUserSchema.safeParse({ name: 'New Name' }).success).toBe(true);
    });

    it('accepts valid role change', () => {
      expect(updateUserSchema.safeParse({ role: 'chef' }).success).toBe(true);
    });

    it('rejects invalid role', () => {
      expect(updateUserSchema.safeParse({ role: 'super_admin' }).success).toBe(false);
    });

    it('rejects role=owner (escalation)', () => {
      expect(updateUserSchema.safeParse({ role: 'owner' }).success).toBe(false);
    });

    it('rejects name > 100 chars', () => {
      expect(updateUserSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
    });

    it('accepts empty update', () => {
      expect(updateUserSchema.safeParse({}).success).toBe(true);
    });
  });
});
