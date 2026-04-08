# RestaurantOS — Multi-Tenant Restaurant E-Menu & Management Platform

A complete restaurant management system with QR-based ordering, kitchen display, billing, analytics, and multi-tenant support.

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Frontend (Vite)           │
│  Customer Menu │ Kitchen │ Staff Dashboards  │
└────────────────────┬────────────────────────┘
                     │ HTTP + WebSocket
┌────────────────────┴────────────────────────┐
│           Fastify API Server                 │
│  Auth │ Menu │ Orders │ Billing │ Analytics  │
└──────┬──────────────────────┬───────────────┘
       │                      │
  ┌────┴────┐           ┌────┴────┐
  │ PostgreSQL │         │  Redis  │
  │  (Data)    │         │ (Cache) │
  └───────────┘         └─────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Node.js + Fastify | High-performance API server |
| Database | PostgreSQL 15+ | ACID-compliant data storage |
| Cache | Redis | Menu caching, session store |
| Frontend | React 18 + Vite | Fast, component-based UI |
| Styling | Tailwind CSS | Utility-first responsive design |
| Real-time | WebSocket | Live order/status updates |
| Auth | JWT + bcrypt | Stateless authentication |
| Images | Sharp | WebP conversion, resizing |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (optional, runs without it)

### Option 1: Docker (recommended)
```bash
docker-compose up -d
cd server && npm install && npm run migrate && npm run seed
```

### Option 2: Local Setup
```bash
# 1. Install dependencies
npm run setup

# 2. Create database
createdb restaurant_platform

# 3. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your database credentials

# 4. Run migrations and seed
npm run migrate
npm run seed

# 5. Start development
npm run dev
```

The app runs at:
- **Frontend**: http://localhost:5173
- **API Server**: http://localhost:3000

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@restaurant.platform | Admin@123456 |
| Owner | owner@spicegarden.com | Owner@123 |
| Manager | manager@spicegarden.com | Manager@123 |
| Waiter | waiter@spicegarden.com | Waiter@123 |
| Chef | chef@spicegarden.com | Chef@1234 |
| Counter | counter@spicegarden.com | Counter@123 |

**Customer access**: Navigate to `/r/spice-garden/t/{tableId}` (table IDs are UUIDs from the database)

## Features

### P0 — Must Have (Implemented)
- **Multi-tenant architecture**: Shared DB with tenant_id isolation
- **6 user roles**: Super Admin, Owner, Manager, Waiter, Chef, Counter
- **Customer QR flow**: Scan → Browse → Order → Track
- **Menu management**: Categories, items, variants, customizations, images
- **Kitchen display**: Real-time order queue with status tracking
- **Table management**: QR codes, status tracking, session management
- **Billing**: Auto-generated bills, tax calculation (CGST/SGST), discounts, split payments
- **Real-time updates**: WebSocket for instant order/status notifications
- **Analytics dashboard**: Revenue, popular items, order trends, hourly distribution
- **Theme customization**: 5 templates, custom colors, fonts, logo upload
- **RBAC**: Role-based access control on every endpoint

### Architecture Decisions
- **Tenant isolation**: `tenant_id` column pattern (not schema-per-tenant) for simplicity and lower resource usage
- **Order numbers**: Redis INCR for atomic daily sequences, SQL fallback
- **Menu caching**: Redis with 5-min TTL, invalidated on writes
- **Image pipeline**: Sharp processes 3 sizes (800x600, 400x300, 80x80) in WebP
- **WebSocket channels**: Role-based routing (kitchen, waiter, counter, customer:{tableId})

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Staff login |
| POST | /api/auth/register | Register staff (owner/manager) |
| POST | /api/auth/refresh | Refresh token |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| GET | /api/public/session/:slug/:tableId | Customer session |

### Menu
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/menu/categories | List categories (tree) |
| POST | /api/menu/categories | Create category |
| GET | /api/menu/items | List items (filterable) |
| POST | /api/menu/items | Create item |
| PUT | /api/menu/items/:id/availability | Toggle availability |
| GET | /api/public/menu/:slug | Public menu (cached) |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/orders | Place order |
| GET | /api/orders | List orders |
| PUT | /api/orders/:id/status | Update status |
| GET | /api/orders/kitchen | Kitchen queue |
| POST | /api/orders/:id/items | Add items to order |

### Billing
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/bills/table/:tableId | Get/generate bill |
| POST | /api/bills/:id/payment | Record payment |
| PUT | /api/bills/:id/discount | Apply discount |
| GET | /api/bills/:id/print | Print format |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics/dashboard | Today's summary |
| GET | /api/analytics/revenue | Revenue data |
| GET | /api/analytics/popular-items | Top items |
| GET | /api/analytics/category-sales | Category breakdown |

## Project Structure

```
restaurant-platform/
├── specs/                    # Feature specifications (9 spec files)
├── server/
│   └── src/
│       ├── config/           # Database, Redis, app config
│       ├── db/
│       │   ├── migrations/   # PostgreSQL schema
│       │   └── seeds/        # Demo data
│       ├── middleware/        # Auth, tenant, validation
│       ├── modules/
│       │   ├── auth/         # JWT auth, RBAC
│       │   ├── tenant/       # Multi-tenant CRUD, branding
│       │   ├── menu/         # Categories, items, variants
│       │   ├── table/        # Tables, QR codes, sessions
│       │   ├── order/        # Order lifecycle
│       │   ├── billing/      # Bills, payments, discounts
│       │   ├── analytics/    # Revenue, stats
│       │   ├── upload/       # Image processing
│       │   └── admin/        # User management, global stats
│       ├── realtime/         # WebSocket manager
│       └── utils/            # Errors, slugify, pagination
├── client/
│   └── src/
│       ├── api/              # HTTP client with auto-refresh
│       ├── store/            # Zustand stores (auth, cart)
│       ├── hooks/            # useWebSocket, useApi
│       ├── components/
│       │   ├── ui/           # Toast, Modal, Badge, Skeleton
│       │   └── layout/       # Sidebar, MobileNav, StaffLayout
│       └── pages/
│           ├── customer/     # Menu, Cart, OrderTracking
│           ├── kitchen/      # KitchenDisplay
│           ├── waiter/       # TableOverview
│           ├── counter/      # BillingPage
│           ├── manager/      # MenuManagement, OrderList
│           ├── owner/        # Dashboard, Analytics, Settings
│           └── admin/        # SuperAdmin
├── docker-compose.yml
└── README.md
```

## Performance Targets

- API response time: < 200ms (95th percentile)
- Memory footprint: < 512MB under normal load
- Menu endpoint: cached, ~5ms response from Redis
- WebSocket latency: < 500ms for order notifications
- Frontend build: < 500KB gzipped
