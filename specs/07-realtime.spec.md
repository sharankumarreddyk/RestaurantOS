# Spec: Real-Time Updates

## Overview
WebSocket-based real-time communication for order flow, kitchen display, and status updates.

## Architecture
- Fastify WebSocket plugin (@fastify/websocket)
- Connection management: Map of `tenantId → Set<WebSocket>`
- Sub-channels by role: kitchen, waiter, counter, customer:{tableId}
- Redis pub/sub for horizontal scaling readiness

## Connection Flow
1. Client connects: `ws://host/ws?token={JWT}`
2. Server validates JWT, extracts { tenantId, role, tableId }
3. Client added to appropriate channel(s)
4. Heartbeat ping every 30s, disconnect after 3 missed pongs

## Message Protocol
```json
{
  "type": "event_name",
  "payload": { ... },
  "timestamp": "ISO8601"
}
```

## Events
| Event | From | To | Payload |
|-------|------|----|---------|
| `order:new` | Server | kitchen, waiter | Full order with items |
| `order:status` | Server | customer, waiter, counter | { orderId, status } |
| `order:item_status` | Server | customer, waiter | { orderId, itemId, status } |
| `order:updated` | Server | kitchen | { orderId, newItems } |
| `table:status` | Server | waiter, counter | { tableId, status } |
| `bill:updated` | Server | counter, customer | { billId, total } |
| `notification` | Server | target role | { message, type } |

## Client Reconnection
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- On reconnect, client sends last received event timestamp
- Server can replay missed events (optional, P1)

## Acceptance Criteria
- [ ] WebSocket connections authenticated via JWT
- [ ] Events routed to correct role channels
- [ ] Kitchen receives new orders instantly (<500ms)
- [ ] Customer sees order status updates in real-time
- [ ] Connections clean up on disconnect
- [ ] Heartbeat keeps connections alive
