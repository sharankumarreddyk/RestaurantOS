import { z } from 'zod';

export const createComboSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().max(500).optional(),
  comboPrice: z.number().positive().max(999999),
  isActive: z.boolean().default(true),
  validFrom: z.string().max(30).optional(),
  validTo: z.string().max(30).optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(20).default(1),
  })).min(1).max(20),
});

export const updateComboSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  comboPrice: z.number().positive().max(999999).optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().max(30).nullable().optional(),
  validTo: z.string().max(30).nullable().optional(),
});
