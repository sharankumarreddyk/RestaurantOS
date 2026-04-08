import { z } from 'zod';

/**
 * Validates required environment variables at startup.
 * In production, crashes immediately if critical secrets are missing or weak.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  BASE_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
});

// Production-specific: reject weak/default secrets
const productionSchema = envSchema.extend({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters in production')
    .refine((s) => s !== 'dev-jwt-secret', 'JWT_SECRET cannot be the default value in production'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters in production')
    .refine((s) => s !== 'dev-refresh-secret', 'JWT_REFRESH_SECRET cannot be the default value in production'),
});

export function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const schema = isProduction ? productionSchema : envSchema;

  const result = schema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`\n❌ Environment validation failed:\n${errors}\n`);
    if (isProduction) {
      process.exit(1);
    } else {
      console.warn('⚠️  Running with invalid config in development mode\n');
    }
  }
}
