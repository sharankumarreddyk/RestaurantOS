# Spec: Order Placement & Kitchen Flow

## Overview
End-to-end order lifecycle: customer/waiter places order → kitchen receives → kitchen prepares → ready for serving.

## Data Model
```
orders {
  id, tenant_id, table_id, session_id,
  order_number (auto-increment per tenant per day),
  status (pending|confirmed|preparing|ready|served|cancelled),
  order_type (dine_in|takeaway),
  placed_by (user_id — staff or null for customer),
  notes, subtotal, tax_amount, total,
  created_at, updated_at
}

order_items {
  id, order_id, menu_item_id, variant_id (nullable),
  quantity, unit_price, total_price,
  customizations (jsonb — selected options with prices),
  notes, status (pending|preparing|ready|served|cancelled),
  created_at
}
```

## Order Number Generation
- Format: `#{day_sequence}` (e.g., #001, #002)
- Resets daily per tenant
- Use Redis INCR for atomic sequence: `order_seq:{tenant_id}:{date}`

## Order Flow
### Customer Flow
1. Browse menu → add items to cart (client-side state)
2. Cart shows items, customizations, quantities, subtotal
3. Place order → `POST /api/orders`
4. Server validates: items available, prices match, table session active
5. Order created with status `pending`
6. WebSocket notification to kitchen
7. Customer sees real-time status updates

### Waiter Flow
1. Select table → browse menu → add items
2. Can add notes per item and per order
3. Place order on behalf of table
4. Can add items to existing active order

### Kitchen Flow
1. New orders appear in queue (WebSocket push)
2. Sound notification for new orders
3. Kitchen staff marks items: `preparing` → `ready`
4. When all items ready, order status → `ready`
5. Timer shows time since order placed

## API Endpoints
- `POST /api/orders` — Place new order
- `GET /api/orders` — List orders (filterable by status, table, date)
- `GET /api/orders/:id` — Order detail
- `PUT /api/orders/:id/status` — Update order status
- `PUT /api/orders/:id/items/:itemId/status` — Update item status
- `POST /api/orders/:id/items` — Add items to existing order
- `DELETE /api/orders/:id/items/:itemId` — Remove item (only if pending)
- `GET /api/orders/kitchen` — Kitchen queue (active orders)
- `GET /api/orders/active` — Active orders for current table (customer)

## Real-Time Events
```
order:new        → kitchen display (new order in queue)
order:status     → customer, waiter (order status changed)
item:status      → customer, waiter (item status changed)
order:updated    → kitchen (items added to order)
```

## Acceptance Criteria
- [ ] Orders validate item availability and prices server-side
- [ ] Order numbers auto-increment daily per tenant
- [ ] Kitchen receives orders in real-time via WebSocket
- [ ] Item-level status tracking works
- [ ] Waiters can add items to existing orders
- [ ] Customers see real-time status updates
- [ ] Cancelled items don't affect prepared items
- [ ] Order totals calculate correctly with variants + customizations
