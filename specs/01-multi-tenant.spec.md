# Spec: Multi-Tenant Architecture

## Overview
Tenant isolation via `tenant_id` column pattern (shared database, shared schema). Each restaurant is a tenant with isolated data.

## Database Tables
- `tenants` — restaurant registration, branding, config
- All tenant-scoped tables include `tenant_id` foreign key with index

## Isolation Strategy
- **Middleware**: Every authenticated request injects `tenant_id` from JWT
- **Query enforcement**: All queries filter by `tenant_id` automatically via Knex query interceptor
- **Super admin bypass**: Super admin endpoints skip tenant filtering

## Branding Model
```
tenant_branding {
  tenant_id: FK
  primary_color: string (#hex)
  secondary_color: string (#hex)
  accent_color: string (#hex)
  font_family: enum (Inter, Playfair, Poppins, Roboto, Merriweather)
  logo_url: string (nullable)
  template: enum (modern_minimalist, classic_elegant, vibrant_colorful, fast_food_casual, fine_dining_premium)
}
```

## Templates
Each template defines default color palette + layout variant:
1. **Modern Minimalist**: White bg, dark text, sans-serif, card-based
2. **Classic Elegant**: Cream bg, serif fonts, ornamental borders
3. **Vibrant Colorful**: Bright gradients, rounded cards, playful
4. **Fast Food Casual**: Bold colors, large images, quick-action buttons
5. **Fine Dining Premium**: Dark bg, gold accents, elegant typography

## API Endpoints
- `POST /api/admin/tenants` — Create restaurant (super admin)
- `GET /api/admin/tenants` — List all restaurants (super admin)
- `PUT /api/admin/tenants/:id` — Update restaurant (super admin)
- `GET /api/tenant/profile` — Get current restaurant profile
- `PUT /api/tenant/branding` — Update branding (owner/manager)
- `GET /api/public/tenant/:slug` — Public restaurant info for customer

## Acceptance Criteria
- [ ] Tenant data is fully isolated — no cross-tenant data leakage
- [ ] Branding changes reflect immediately on customer-facing pages
- [ ] Templates provide complete visual customization
- [ ] Super admin can CRUD all tenants
- [ ] Slug-based public URLs work for customers
