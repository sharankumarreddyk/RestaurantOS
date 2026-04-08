import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { authenticate } from '../../middleware/auth.js';
import { tenantContext, requireTenant } from '../../middleware/tenant.js';
import config from '../../config/index.js';

export default async function uploadRoutes(fastify) {
  fastify.post('/upload/image', {
    preHandler: [authenticate, tenantContext, requireTenant],
  }, async (request) => {
    const file = await request.file();
    if (!file) return { statusCode: 400, error: 'No file uploaded' };

    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return { statusCode: 400, error: 'Only JPEG, PNG, and WebP images are allowed' };
    }

    const tenantDir = path.join(config.upload.dir, 'tenants', request.tenantId, 'menu');
    await fs.mkdir(tenantDir, { recursive: true });

    const buffer = await file.toBuffer();
    if (buffer.length > config.upload.maxFileSize) {
      return { statusCode: 400, error: 'File too large (max 5MB)' };
    }

    const timestamp = Date.now();
    const baseName = `${timestamp}`;

    // Process images in 3 sizes
    const sizes = [
      { suffix: 'full', width: 800, height: 600 },
      { suffix: 'card', width: 400, height: 300 },
      { suffix: 'thumb', width: 80, height: 80 },
    ];

    const urls = {};
    for (const size of sizes) {
      const filename = `${baseName}_${size.suffix}.webp`;
      const filepath = path.join(tenantDir, filename);

      await sharp(buffer)
        .resize(size.width, size.height, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(filepath);

      urls[size.suffix] = `/uploads/tenants/${request.tenantId}/menu/${filename}`;
    }

    return {
      imageUrl: urls.full,
      cardUrl: urls.card,
      thumbnailUrl: urls.thumb,
    };
  });

  // Logo upload
  fastify.post('/upload/logo', {
    preHandler: [authenticate, tenantContext, requireTenant],
  }, async (request) => {
    const file = await request.file();
    if (!file) return { statusCode: 400, error: 'No file uploaded' };

    const buffer = await file.toBuffer();
    const tenantDir = path.join(config.upload.dir, 'tenants', request.tenantId);
    await fs.mkdir(tenantDir, { recursive: true });

    const filename = `logo_${Date.now()}.webp`;
    const filepath = path.join(tenantDir, filename);

    await sharp(buffer)
      .resize(200, 200, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(filepath);

    return { logoUrl: `/uploads/tenants/${request.tenantId}/${filename}` };
  });
}
