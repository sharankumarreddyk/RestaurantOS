import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['veg', 'non_veg', 'vegan', 'egg', 'mixed']).default('mixed'),
  parentId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(9999),
  })).max(200),
});

export const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  basePrice: z.number().positive().max(999999),
  prepTimeMinutes: z.number().int().min(1).max(480).default(15),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  isChefSpecial: z.boolean().default(false),
  foodType: z.enum(['veg', 'non_veg', 'vegan', 'egg']).default('veg'),
  allergens: z.array(z.string().max(50)).max(20).default([]),
  variants: z.array(z.object({
    name: z.string().min(1).max(50),
    price: z.number().positive().max(999999),
    isDefault: z.boolean().default(false),
  })).max(10).optional(),
  customizations: z.array(z.object({
    name: z.string().min(1).max(100),
    minSelections: z.number().int().min(0).default(0),
    maxSelections: z.number().int().min(1).max(20).default(1),
    isRequired: z.boolean().default(false),
    options: z.array(z.object({
      name: z.string().min(1).max(100),
      priceAdjustment: z.number().min(-10000).max(10000).default(0),
      isDefault: z.boolean().default(false),
    })).max(20),
  })).max(10).optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const menuQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  foodType: z.enum(['veg', 'non_veg', 'vegan', 'egg']).optional(),
  isAvailable: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.string().max(10).optional(),
  limit: z.string().max(10).optional(),
});
