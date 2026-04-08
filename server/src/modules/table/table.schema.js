import { z } from 'zod';

export const createTableSchema = z.object({
  tableNumber: z.number().int().positive(),
  label: z.string().optional(),
  capacity: z.number().int().min(1).default(4),
});

export const updateTableSchema = z.object({
  label: z.string().optional(),
  capacity: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning']),
});
