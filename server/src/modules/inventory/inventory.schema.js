import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.enum(['kg', 'g', 'liters', 'ml', 'pieces', 'packets', 'bottles', 'dozen']),
  currentStock: z.number().min(0).max(9999999).default(0),
  lowStockThreshold: z.number().min(0).max(9999999).default(0),
  costPerUnit: z.number().min(0).max(999999).default(0),
});

export const updateStockSchema = z.object({
  changeAmount: z.number().min(-9999999).max(9999999),
  reason: z.enum(['restock', 'waste', 'adjustment', 'order']).default('adjustment'),
});

export const linkIngredientSchema = z.object({
  menuItemId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  quantityNeeded: z.number().positive().max(99999),
});
