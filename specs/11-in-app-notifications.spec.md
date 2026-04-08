# Spec: In-App Notification System

## Overview
Persistent, role-targeted notification system that ensures every staff member and customer sees critical events — even if they weren't watching the screen when it happened.

## Current State
- WebSocket channels exist (kitchen, waiter, counter, customer:{tableId})
- Kitchen gets audio alert + toast on new orders
- All other roles and customers get nothing
- No notification persistence, no bell icon, no history, no call-waiter

## Notification Types

| Type | Title Template | Target | Trigger | Priority |
|------|---------------|--------|---------|----------|
| `order_new` | New order #{num} — Table {n} | kitchen, waiter | Order created | high |
| `order_confirmed` | Order #{num} confirmed | customer:{table} | Status → confirmed | normal |
| `order_preparing` | Order #{num} is being prepared | customer:{table} | Status → preparing | normal |
| `order_ready` | Order #{num} ready for Table {n} | waiter, customer:{table} | Status → ready | high |
| `order_served` | Order #{num} served | customer:{table} | Status → served | low |
| `call_waiter` | Table {n} needs assistance | waiter | Customer taps button | high |
| `call_bill` | Table {n} requests the bill | counter, waiter | Customer taps button | high |
| `bill_paid` | Bill #{num} paid — Table {n} | waiter, counter | Payment recorded, status=paid | normal |
| `item_unavailable` | {item} marked unavailable | kitchen, waiter | Item toggled off | normal |

## Data Model

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_role VARCHAR(20),
  target_table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body VARCHAR(500),
  entity VARCHAR(50),
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  priority VARCHAR(10) DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notif_role ON notifications (tenant_id, target_role, is_read, created_at DESC);
CREATE INDEX idx_notif_user ON notifications (target_user_id, is_read, created_at DESC);
CREATE INDEX idx_notif_table ON notifications (target_table_id, is_read, created_at DESC);
CREATE INDEX idx_notif_cleanup ON notifications (created_at);
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/notifications | staff/customer | List notifications (paginated, filtered by role/user) |
| GET | /api/notifications/unread-count | staff/customer | `{ count: N }` |
| PUT | /api/notifications/:id/read | staff/customer | Mark one as read |
| PUT | /api/notifications/read-all | staff/customer | Mark all as read for current user/role |
| POST | /api/notifications/call-waiter | customer | Customer calls waiter for their table |
| POST | /api/notifications/call-bill | customer | Customer requests the bill |

## Server: NotificationService

Central service called from order/billing routes after state changes:

```
NotificationService.create({ tenantId, type, title, body?, targetRole?, targetUserId?, targetTableId?, entity?, entityId?, priority? })
  → INSERT into notifications table
  → Broadcast via WebSocket { type: 'notification:new', payload: notification }
```

## Frontend Components

### NotificationBell (staff)
- Bell icon in Sidebar header + MobileNav
- Red badge with unread count (hides when 0)
- Click opens NotificationDropdown

### NotificationDropdown
- Scrollable list of notifications (last 50)
- Each item: type icon, title, relative time, read/unread dot
- "Mark all read" button at top
- Click notification → navigate to related entity (order, bill, table)

### notificationStore (Zustand)
- `notifications[]`, `unreadCount`, `soundEnabled`
- Hydrate from `GET /notifications` on mount
- Append from WebSocket `notification:new` events
- Play sound on high-priority notifications (configurable)

### CustomerCallWaiter
- Floating button on customer menu (bottom-right, above cart bar)
- Two actions: "Call Waiter" and "Request Bill"
- Cooldown: 60s between taps (prevent spam)
- Visual feedback: button shows "Waiter called!" for 5s

### CustomerOrderAlert
- Full-width slide-down banner when order status changes to `ready`
- Persistent until dismissed
- Vibration (Navigator.vibrate) on mobile if available
- Shows: "Your order is ready!" with order number

## Sound System
- 3 distinct sounds: new_order (kitchen), ready (waiter), call_waiter (waiter)
- Stored as base64 data URIs (no external files)
- Toggle in localStorage per device: `notification_sound_enabled`

## Acceptance Criteria
- [ ] Notifications persist in DB and survive page refresh
- [ ] Bell icon shows correct unread count across all staff pages
- [ ] Notifications list shows history with read/unread state
- [ ] Call Waiter button visible on customer menu, creates notification for waiters
- [ ] Customer sees banner when order status → ready
- [ ] Sound plays on high-priority notifications (when enabled)
- [ ] Notifications scoped by tenant — no cross-tenant leakage
- [ ] Old notifications auto-cleaned (>7 days) — future cron job
- [ ] WebSocket delivers notifications in <500ms

## Risks & Tradeoffs
- **Write amplification**: Each order event creates 2-3 notification rows. For a busy restaurant (~200 orders/day), that's ~600 rows/day — trivial for PostgreSQL.
- **Notification fatigue**: Mitigated by priority levels and future preferences page (P1).
- **Call waiter spam**: 60s cooldown on client, rate limit on server (5/min per table).
- **Customer alert while on another page**: Only works while customer has the tab open. PWA push (P1) needed for backgrounded tabs.
