import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  role: z.enum(['manager', 'waiter', 'chef', 'counter', 'cafe_operator']).optional(),
  isActive: z.boolean().optional(),
});
