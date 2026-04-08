# Spec: Customer-Facing Branding

## Overview
Complete the branding pipeline so that every customer-visible surface — menu, cart, order tracking, QR codes, and printed bills — reflects the restaurant's identity (logo, colors, template layout, name, cover image).

## Current State (already built)
- `tenant_branding` table with primary/secondary/accent colors, font_family, logo_url, cover_image_url, template enum
- `PUT /api/tenant/branding` API
- `Settings.jsx` with color pickers, template selector, font dropdown, logo upload
- `CustomerMenu.jsx` sets CSS vars on load (colors + font only)

## What This Spec Adds

### 1. BrandingProvider (React Context)
Wraps all `/r/:slug/*` routes. On mount:
- Fetches tenant branding (reuses menu data if available)
- Sets CSS custom properties on `<html>`: `--color-primary`, `--color-secondary`, `--color-accent`, `--font-brand`
- Sets `document.title` = `"{Restaurant Name}"`
- Sets `<meta name="theme-color">` to primary_color
- Sets dynamic `<link rel="icon">` to favicon_url (if present)
- Applies template class to wrapper: `template-{template_name}`
- Provides `{ branding, restaurant }` via React Context to all children
- Shows branded splash screen (logo + name + spinner in brand colors) while loading

### 2. Logo in Customer Header
All customer pages show:
```
┌─────────────────────────────┐
│ [Logo 36px] Restaurant Name │
│            Table 5          │
└─────────────────────────────┘
```
- Logo from `branding.logo_url`, rounded, 36x36
- Fallback: first letter of restaurant name in accent-colored circle

### 3. Cover Image Hero
Between header and search bar on menu page:
```
┌─────────────────────────────┐
│                             │
│     [Cover Image 180px]     │
│     Restaurant Name         │
│     Tagline (if set)        │
│                             │
└─────────────────────────────┘
```
- From `branding.cover_image_url`
- Gradient overlay (bottom dark) for text readability
- Fallback: solid primary_color background with name centered

### 4. Template CSS Classes
Each template applies distinct visual treatment via CSS class on the wrapper:

| Template | Cards | Background | Headers | Borders |
|----------|-------|------------|---------|---------|
| modern_minimalist | flat, rounded-xl, shadow-sm | white/gray-50 | sans-serif | none |
| classic_elegant | rounded-lg, subtle shadow | cream (#fdf6e3) | serif | thin accent |
| vibrant_colorful | rounded-2xl, bold shadow | gradient hints | bold sans | colored |
| fast_food_casual | rounded-lg, hard shadow | white, loud accent fills | extra-bold | thick dividers |
| fine_dining_premium | rounded-sm, glow | dark (#111) bg, light text | serif, spaced | thin gold |

### 5. Branded QR Codes
- QR foreground color = `branding.primary_color`
- Logo composited in center (20% of QR area) via Sharp
- Background remains white for scan reliability
- Generated on `GET /api/tables/:id/qr`

### 6. Logo on Printed Bill
`GET /api/bills/:id/print` response includes `logoUrl` field.
Frontend print view renders logo above restaurant name.

### 7. Promotional Banner (P1)
Optional banner between hero and menu:
```
┌─────────────────────────────┐
│ 🎉 20% off all biryanis!   │
└─────────────────────────────┘
```
- Stored as `promo_banner_text` + `promo_banner_url` in tenant_branding
- Rendered as dismissible card with accent background
- Owner configures in Settings

## Data Model Changes

```sql
ALTER TABLE tenant_branding ADD COLUMN tagline VARCHAR(200);
ALTER TABLE tenant_branding ADD COLUMN favicon_url VARCHAR(500);
ALTER TABLE tenant_branding ADD COLUMN promo_banner_text VARCHAR(300);
ALTER TABLE tenant_branding ADD COLUMN promo_banner_url VARCHAR(500);
```

## API Changes

### Modified: `PUT /api/tenant/branding`
New optional fields in request body:
```json
{
  "tagline": "Authentic North Indian Cuisine Since 1985",
  "faviconUrl": "...",
  "promoBannerText": "20% off all biryanis this week!",
  "promoBannerUrl": "/r/spice-garden?promo=biryani20"
}
```

### Modified: `GET /api/tables/:id/qr`
Response now generates colored QR with logo overlay. No request change.

### Modified: `GET /api/bills/:id/print`
Response now includes `logoUrl` field.

## Frontend Changes

### New Files
- `client/src/components/customer/BrandingProvider.jsx` — context + CSS + title + favicon
- `client/src/themes/templates.css` — 5 template class definitions

### Modified Files
- `client/src/App.jsx` — wrap `/r/:slug/*` routes in BrandingProvider
- `client/src/pages/customer/CustomerMenu.jsx` — remove inline branding, add logo+hero+promo
- `client/src/pages/customer/Cart.jsx` — add branded header with logo
- `client/src/pages/customer/OrderTracking.jsx` — add branded header with logo
- `client/src/pages/customer/CustomerSession.jsx` — branded splash screen
- `client/src/pages/owner/Settings.jsx` — add tagline, promo banner, favicon fields
- `client/src/index.css` — import templates.css

### Server Modified Files
- `server/src/modules/tenant/tenant.schema.js` — add new branding fields
- `server/src/modules/tenant/tenant.service.js` — handle new fields in updateBranding
- `server/src/modules/table/table.service.js` — branded QR generation
- `server/src/modules/billing/billing.service.js` — include logo in print response

## Acceptance Criteria
- [ ] Logo displays in header on menu, cart, and order tracking pages
- [ ] Cover image renders as hero with gradient overlay
- [ ] Fallback displays when no logo/cover image is set
- [ ] All 5 templates produce visually distinct layouts
- [ ] Colors, font, and template apply to ALL customer pages (menu, cart, tracking)
- [ ] Page title shows restaurant name
- [ ] Theme-color meta updates to match primary color
- [ ] QR codes use restaurant's primary color + logo
- [ ] Printed bill includes restaurant logo
- [ ] Promotional banner shows when configured, is dismissible
- [ ] Live preview in Settings shows template + color changes (P1)
- [ ] Branding loads from Redis cache (5min TTL, already implemented)

## Risks & Tradeoffs
- **Logo-in-QR reduces scan reliability**: Keep logo to 20% of QR area max, test with multiple phone cameras
- **Dark template (fine_dining) needs inverted text**: All text/icon colors must invert; test every component
- **Dynamic favicon causes extra HTTP request**: Only fetch if favicon_url is set; use data-URI for inline
- **Promo banner dismissed state**: Store in sessionStorage, not localStorage (reset per visit)
