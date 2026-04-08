import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  currency: z.string().default('INR'),
  businessType: z.enum(['restaurant', 'cafe']).default('restaurant'),
  taxConfig: z.object({
    cgst: z.number().min(0).max(50).optional(),
    sgst: z.number().min(0).max(50).optional(),
    vat: z.number().min(0).max(50).optional(),
  }).optional(),
  serviceChargePercent: z.number().min(0).max(100).default(0),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  currency: z.string().optional(),
  taxConfig: z.object({
    cgst: z.number().min(0).max(50).optional(),
    sgst: z.number().min(0).max(50).optional(),
    vat: z.number().min(0).max(50).optional(),
  }).optional(),
  serviceChargePercent: z.number().min(0).max(100).optional(),
  sessionTimeoutMinutes: z.number().min(10).max(480).optional(),
  isActive: z.boolean().optional(),
});

export const updateBrandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.enum(['Inter', 'Playfair Display', 'Poppins', 'Roboto', 'Merriweather']).optional(),
  logoUrl: z.string().max(500).optional(),
  coverImageUrl: z.string().max(500).optional(),
  template: z.enum([
    'modern_minimalist', 'classic_elegant', 'vibrant_colorful',
    'fast_food_casual', 'fine_dining_premium'
  ]).optional(),
  tagline: z.string().max(200).optional(),
  faviconUrl: z.string().max(500).optional(),
  promoBannerText: z.string().max(300).optional(),
  promoBannerUrl: z.string().max(500).optional(),
});
