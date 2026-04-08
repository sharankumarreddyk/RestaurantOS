# Spec: Cafe Mode — Simplified Counter-Service Variant

## Overview
Small cafes (smokes, drinks, snacks) with 1-2 staff don't need the full restaurant workflow. Cafe mode provides a simplified experience focused on one problem: **tracking which table ordered what so the operator can deliver correctly.**

## Business Type
`tenants.business_type` = `'restaurant'` (default) or `'cafe'`
Selected by super admin at tenant creation. Drives all conditional behavior.

## Cafe Roles
- `owner` — full control (same as restaurant)
- `cafe_operator` — single combined role replacing waiter+chef+counter. Can: take orders, view table tracker, mark items delivered, close tabs, view basic stats.

## Order Flow
Restaurant: pending → confirmed → preparing → ready → served (5 states)
Cafe: pending → delivered (2 states — maps to `served` in DB)

## Table Tracker (core screen)
Single-page view showing ALL tables:
- Occupied tables show ordered items with delivery checkboxes
- Running total per table
- "Close Tab" = auto-generate bill + mark all delivered + free table
- Color-coded: green (available), amber (occupied), red (items aging >10min)

## Quick Close
One-tap table close: generates bill with tax, marks all orders as served, closes table session, frees table status to available.

## Simplified UI
| Feature | Restaurant | Cafe |
|---------|-----------|------|
| Sidebar items | 8-10 | 4: Dashboard, Menu, Tables, Settings |
| Kitchen Display | Full 3-column KDS | Hidden (replaced by Table Tracker) |
| Reservations | Full booking | Hidden |
| Inventory | Ingredient-level | Hidden (use simple menu toggle) |
| Analytics | Full dashboards | Simple: today's revenue + top items |
| Billing | Split, tips, service charge | Simple total + tax |
| Customer menu | Full: hero, combos, filters | Simpler: fewer categories, compact cards |

## Data Model
```sql
ALTER TABLE tenants ADD COLUMN business_type VARCHAR(20) DEFAULT 'restaurant';
-- Extend user roles to include cafe_operator
```

## Acceptance Criteria
- [ ] Super admin can select "Restaurant" or "Cafe" at creation
- [ ] Cafe operator role works for login and all cafe screens
- [ ] Table Tracker shows all tables with items and delivery status
- [ ] Close Tab generates bill and frees table in one tap
- [ ] Sidebar shows simplified navigation for cafe tenants
- [ ] Order status allows pending → delivered (served) for cafes
- [ ] Restaurant mode is completely unchanged
