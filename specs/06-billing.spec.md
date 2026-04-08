# Spec: Billing & Payment

## Overview
Auto-generated bills from orders with tax calculation, discounts, split bill, and payment tracking.

## Data Model
```
bills {
  id, tenant_id, table_id, session_id,
  bill_number (auto-increment per tenant),
  subtotal, tax_amount, service_charge, discount_amount, total,
  tax_config (jsonb — { cgst: 2.5, sgst: 2.5 } or { vat: 10 }),
  service_charge_percent, discount (jsonb — { type: 'percent'|'fixed', value: 10, reason: '' }),
  status (open|closed|paid|partially_paid),
  payment_method (cash|card|upi|mixed|null),
  paid_amount, notes,
  created_at, updated_at, closed_at
}

bill_items {
  id, bill_id, order_item_id, menu_item_name, quantity,
  unit_price, total_price
}

payments {
  id, bill_id, tenant_id, amount, method (cash|card|upi),
  reference_number, received_by (user_id),
  created_at
}

split_bills {
  id, parent_bill_id, split_type (equal|by_items),
  split_count, created_at
}

split_bill_items {
  id, split_bill_id, bill_item_id, assigned_to (split index 1..N)
}
```

## Tax Calculation
- Configurable per tenant: CGST+SGST (India) or flat VAT
- Applied on subtotal after discounts
- `tax_amount = (subtotal - discount_amount) * tax_rate`

## Bill Generation
1. When first order for a table is served, bill auto-opens
2. Additional orders append to same bill
3. Counter staff can view/modify bill
4. Discount applied manually by manager/owner/counter
5. Service charge: optional, configurable percentage

## Split Bill
- **Equal split**: total / N people
- **By items**: assign specific items to specific splits
- Each split generates a sub-bill with its own payment status

## API Endpoints
- `GET /api/bills/table/:tableId` — Get active bill for table
- `GET /api/bills/:id` — Bill detail with items
- `PUT /api/bills/:id/discount` — Apply discount
- `PUT /api/bills/:id/service-charge` — Set service charge
- `POST /api/bills/:id/payment` — Record payment
- `POST /api/bills/:id/split` — Split bill
- `PUT /api/bills/:id/close` — Close bill
- `GET /api/bills/:id/print` — Print-ready format (HTML)
- `GET /api/bills` — List bills (filterable by date, status)

## Print Format
```
================================
     {Restaurant Name}
     {Address}
     {Phone}
================================
Bill #: {bill_number}
Table: {table_number}
Date: {date}    Time: {time}
--------------------------------
Item          Qty   Price  Total
{items...}
--------------------------------
Subtotal:              {amount}
Discount:             -{amount}
CGST (2.5%):          +{amount}
SGST (2.5%):          +{amount}
Service Charge (5%):  +{amount}
================================
TOTAL:                 {amount}
================================
Payment: {method}
Thank you for dining with us!
================================
```

## Acceptance Criteria
- [ ] Bills auto-generate from served orders
- [ ] Tax calculation supports CGST/SGST and VAT
- [ ] Discounts apply correctly (percentage and fixed)
- [ ] Split bill works by equal division and by items
- [ ] Partial payments tracked correctly
- [ ] Print format renders cleanly
- [ ] Bill totals are mathematically accurate
- [ ] Payment method tracking works
