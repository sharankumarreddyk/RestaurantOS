# Spec: Authentication & Role-Based Access Control

## Overview
JWT-based stateless auth with role-based permissions. Customer sessions are temporary (QR-scan based).

## Roles
| Role | Scope | Description |
|------|-------|-------------|
| super_admin | Global | Manages all tenants, platform-level |
| owner | Tenant | Full restaurant control |
| manager | Tenant | Menu, staff, stats management |
| waiter | Tenant | Place/manage orders for tables |
| chef | Tenant | View/manage kitchen orders |
| counter | Tenant | Billing and payments |
| customer | Tenant+Table | Temporary session, browse & order |

## Auth Flow
### Staff Auth
1. `POST /api/auth/login` — email + password → JWT (access + refresh)
2. Access token: 15min expiry, contains { userId, tenantId, role }
3. Refresh token: 7d expiry, stored in httpOnly cookie
4. `POST /api/auth/refresh` — rotate tokens
5. `POST /api/auth/logout` — invalidate refresh token

### Customer Auth
1. Scan QR → `GET /api/public/session/:restaurantSlug/:tableId`
2. Server creates temporary session token (4h expiry)
3. Token contains { tenantId, tableId, role: 'customer', sessionId }
4. No password needed — QR scan = authentication

## Password Requirements
- Minimum 8 characters
- Hashed with bcrypt (12 rounds)
- No plaintext storage ever

## RBAC Middleware
```javascript
// Usage: route.addHook('preHandler', authorize(['owner', 'manager']))
// Checks JWT → extracts role → validates against allowed roles
```

## Permission Matrix
| Resource | super_admin | owner | manager | waiter | chef | counter | customer |
|----------|-------------|-------|---------|--------|------|---------|----------|
| Tenants | CRUD | R own | R own | - | - | - | - |
| Users | CRUD | CRUD own | CRU own | R self | R self | R self | - |
| Menu | CRUD all | CRUD | CRUD | R | R | R | R |
| Tables | CRUD all | CRUD | CRUD | R | - | R | R own |
| Orders | R all | CRUD | CRUD | CRU | RU | R | CR own |
| Bills | R all | CRUD | CRUD | R | - | RU | R own |
| Analytics | R all | R own | R own | - | - | - | - |

## API Endpoints
- `POST /api/auth/register` — Register staff (owner/manager only)
- `POST /api/auth/login` — Staff login
- `POST /api/auth/refresh` — Refresh token
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current user profile
- `PUT /api/auth/password` — Change password
- `GET /api/public/session/:slug/:tableId` — Customer session

## Acceptance Criteria
- [ ] JWT tokens are properly signed and validated
- [ ] Role-based access prevents unauthorized operations
- [ ] Customer sessions are scoped to table + restaurant
- [ ] Refresh token rotation works correctly
- [ ] Password hashing uses bcrypt with 12 rounds
- [ ] Token expiry is enforced
