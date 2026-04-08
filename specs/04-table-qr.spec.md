# Spec: Table & QR Code Management

## Overview
Table management with QR codes that encode restaurant + table context. QR scan creates a customer session.

## Data Model
```
tables {
  id, tenant_id, table_number, label (e.g., "Patio 3"),
  capacity (int), status (available|occupied|reserved|cleaning),
  qr_code_url, session_timeout_minutes (default: 120),
  is_active, created_at, updated_at
}

table_sessions {
  id, tenant_id, table_id, session_token,
  status (active|closed), customer_count,
  started_at, last_activity_at, closed_at
}
```

## QR Code Encoding
- URL format: `{BASE_URL}/r/{restaurant_slug}/t/{table_id}`
- QR contains this URL directly — scanning opens the customer web app
- QR image generated as SVG (scalable for printing) and PNG (300 DPI)

## Session Flow
1. Customer scans QR → hits `/r/:slug/t/:tableId`
2. Frontend calls `GET /api/public/session/:slug/:tableId`
3. Server creates session + JWT with { tenantId, tableId, sessionId, role: 'customer' }
4. Table status changes to `occupied`
5. Session timeout: auto-close after `session_timeout_minutes` of inactivity
6. Manual close: staff can close session (clears table)

## API Endpoints
- `GET /api/tables` — List tables with status
- `POST /api/tables` — Create table
- `PUT /api/tables/:id` — Update table
- `DELETE /api/tables/:id` — Soft delete
- `PUT /api/tables/:id/status` — Update table status
- `GET /api/tables/:id/qr` — Generate/regenerate QR code
- `GET /api/tables/:id/qr/download` — Download QR as PNG/SVG
- `POST /api/tables/:id/session/close` — Close table session
- `GET /api/tables/overview` — Dashboard view (all tables with status + current orders)

## Acceptance Criteria
- [ ] QR codes encode correct URL with restaurant slug + table ID
- [ ] Scanning QR creates a customer session automatically
- [ ] Table status updates in real-time on staff dashboards
- [ ] Session timeout auto-closes inactive sessions
- [ ] QR codes downloadable in print-ready format
- [ ] Table overview shows live status for all tables
