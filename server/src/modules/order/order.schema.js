import { z } from 'zod';

export const createOrderSchema = z.object({
  tableId: z.string().uuid(),
  orderType: z.enum(['dine_in', 'takeaway']).default('dine_in'),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(99),
    customizations: z.array(z.object({
      groupId: z.string().uuid(),
      groupName: z.string().max(100),
      optionId: z.string().uuid(),
      optionName: z.string().max(100),
      priceAdjustment: z.number().min(-10000).max(10000),
    })).max(20).default([]),
    notes: z.string().max(200).optional(),
  })).min(1).max(50),
});

export const addItemsSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(99),
    customizations: z.array(z.object({
      groupId: z.string().uuid(),
      groupName: z.string().max(100),
      optionId: z.string().uuid(),
      optionName: z.string().max(100),
      priceAdjustment: z.number().min(-10000).max(10000),
    })).max(20).default([]),
    notes: z.string().max(200).optional(),
  })).min(1).max(50),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['confirmed', 'preparing', 'ready', 'served', 'cancelled']),
});

export const updateItemStatusSchema = z.object({
  status: z.enum(['preparing', 'ready', 'served', 'cancelled']),
});

export const orderQuerySchema = z.object({
  status: z.string().max(100).optional(),
  tableId: z.string().uuid().optional(),
  from: z.string().max(30).optional(),
  to: z.string().max(30).optional(),
  page: z.string().max(10).optional(),
  limit: z.string().max(10).optional(),
});
