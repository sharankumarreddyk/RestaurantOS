import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().max(20).optional(),
  role: z.enum(['owner', 'manager', 'waiter', 'chef', 'counter', 'cafe_operator']),
  tenantId: z.string().uuid().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required').max(256),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
