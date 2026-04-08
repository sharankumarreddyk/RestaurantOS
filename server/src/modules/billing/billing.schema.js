import { z } from 'zod';

export const applyDiscountSchema = z.object({
  type: z.enum(['percent', 'fixed']),
  value: z.number().positive().max(100000),
  reason: z.string().max(200).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive().max(10000000),
  method: z.enum(['cash', 'card', 'upi']),
  referenceNumber: z.string().max(100).optional(),
});

export const splitBillSchema = z.object({
  splitType: z.enum(['equal', 'by_items']),
  splitCount: z.number().int().min(2).max(20).optional(),
  splits: z.array(z.object({
    itemIds: z.array(z.string().uuid()),
  })).max(20).optional(),
});

export const serviceChargeSchema = z.object({
  percent: z.number().min(0).max(50),
});

export const addTipSchema = z.object({
  amount: z.number().min(0).max(100000),
});
