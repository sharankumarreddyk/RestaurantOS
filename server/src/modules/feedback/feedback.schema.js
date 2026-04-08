import { z } from 'zod';

export const submitFeedbackSchema = z.object({
  orderId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  overallRating: z.number().int().min(1).max(5),
  foodRating: z.number().int().min(1).max(5).optional(),
  serviceRating: z.number().int().min(1).max(5).optional(),
  ambienceRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  googleReviewPrompted: z.boolean().optional(),
});
