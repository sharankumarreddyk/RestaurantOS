import 'dotenv/config';
import { validateEnv } from './validate.js';

// Validate environment on import
validateEnv();

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  baseUrl: process.env.BASE_URL || 'http://localhost:5173',

  db: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/restaurant_platform',
    pool: { min: 2, max: 20 },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  },

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@restaurant.platform',
    password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456',
  },

  security: {
    maxLoginAttempts: 5,
    lockoutMinutes: 30,
    passwordResetExpiryMinutes: 60,
    maxWsConnectionsPerUser: 10,
    requestBodyLimit: 1048576, // 1MB
  },
};

export default config;
