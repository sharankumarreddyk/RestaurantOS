import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createReservationSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().min(5).max(20),
  customerEmail: z.string().email().max(255).optional(),
  partySize: z.number().int().min(1).max(50).default(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(timeRegex, 'Time must be HH:MM format'),
  durationMinutes: z.number().int().min(15).max(480).default(90),
  tableId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const updateReservationStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']),
});

export const addWaitlistSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().min(5).max(20),
  partySize: z.number().int().min(1).max(50).default(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(500).optional(),
});
