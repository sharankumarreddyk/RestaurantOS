import { z } from 'zod';

export const notificationQuerySchema = z.object({
  page: z.string().max(10).optional(),
  limit: z.string().max(10).optional(),
});

export const callWaiterSchema = z.object({
  type: z.enum(['waiter', 'bill']).default('waiter'),
});
