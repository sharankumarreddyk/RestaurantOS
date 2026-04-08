# Spec: Menu Management System

## Overview
Full menu CRUD with categories, items, variants, customizations, and image optimization pipeline.

## Data Model

### Categories
```
menu_categories {
  id, tenant_id, name, slug, type (veg|non_veg|vegan|egg),
  parent_id (nullable — for sub-categories),
  sort_order, image_url, is_active,
  created_at, updated_at
}
```

### Menu Items
```
menu_items {
  id, tenant_id, category_id, name, slug, description,
  base_price, image_url, thumbnail_url,
  prep_time_minutes, is_available, is_popular, is_chef_special,
  allergens (jsonb — array of strings),
  sort_order, created_at, updated_at
}
```

### Item Variants (sizes/types)
```
item_variants {
  id, menu_item_id, name (e.g., "Small", "Large"),
  price_adjustment (can be +/- or absolute),
  is_default, is_available
}
```

### Customization Groups
```
customization_groups {
  id, menu_item_id, name (e.g., "Spice Level"),
  min_selections, max_selections, is_required
}
```

### Customization Options
```
customization_options {
  id, group_id, name (e.g., "Extra Spicy"),
  price_adjustment, is_default, is_available
}
```

## Image Pipeline
1. Upload → validate (jpg/png/webp, max 5MB)
2. Sharp processing: resize to 800x600 (main), 400x300 (card), 80x80 (thumbnail)
3. Convert to WebP (quality 80)
4. Store in `/uploads/tenants/{tenant_id}/menu/`
5. Return all resolution URLs

## API Endpoints
### Categories
- `GET /api/menu/categories` — List categories (nested tree)
- `POST /api/menu/categories` — Create category
- `PUT /api/menu/categories/:id` — Update category
- `DELETE /api/menu/categories/:id` — Soft delete
- `PUT /api/menu/categories/reorder` — Bulk reorder

### Items
- `GET /api/menu/items` — List items (filterable by category, type, availability)
- `GET /api/menu/items/:id` — Item detail with variants & customizations
- `POST /api/menu/items` — Create item
- `PUT /api/menu/items/:id` — Update item
- `DELETE /api/menu/items/:id` — Soft delete
- `PUT /api/menu/items/:id/availability` — Toggle availability
- `PUT /api/menu/items/reorder` — Bulk reorder

### Bulk Operations
- `POST /api/menu/import` — Import from CSV/JSON
- `GET /api/menu/export` — Export to CSV/JSON

### Public (Customer)
- `GET /api/public/menu/:slug` — Full menu for restaurant (cached in Redis, 5min TTL)
- `GET /api/public/menu/:slug/search?q=` — Search menu items

## Caching Strategy
- Redis cache key: `menu:{tenant_id}` — full menu JSON
- TTL: 5 minutes
- Invalidate on any menu write operation
- Customer menu endpoint reads from cache first

## Acceptance Criteria
- [ ] Categories support nesting (parent/child)
- [ ] Drag-and-drop reordering via sort_order API
- [ ] Image pipeline produces 3 resolutions in WebP
- [ ] Variants and customizations attach correctly to items
- [ ] Menu cache invalidates on writes
- [ ] Bulk import/export works for CSV and JSON
- [ ] Search works across name and description
- [ ] Allergen information stored and returned
