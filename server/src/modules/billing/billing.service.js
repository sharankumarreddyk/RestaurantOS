import db from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

async function getNextBillNumber(tenantId) {
  const result = await db('bills')
    .where({ tenant_id: tenantId })
    .max('bill_number as max');
  return (result[0]?.max || 0) + 1;
}

function calculateBillTotals(subtotal, taxConfig, serviceChargePercent, discount) {
  let discountAmount = 0;
  if (discount && discount.type) {
    discountAmount = discount.type === 'percent'
      ? subtotal * (discount.value / 100)
      : Math.min(discount.value, subtotal);
  }

  const afterDiscount = subtotal - discountAmount;
  const taxRate = (taxConfig.cgst || 0) + (taxConfig.sgst || 0) + (taxConfig.vat || 0);
  const taxAmount = afterDiscount * (taxRate / 100);
  const serviceCharge = afterDiscount * (serviceChargePercent / 100);
  const total = afterDiscount + taxAmount + serviceCharge;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount_amount: Math.round(discountAmount * 100) / 100,
    tax_amount: Math.round(taxAmount * 100) / 100,
    service_charge: Math.round(serviceCharge * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export async function getBillForTable(tenantId, tableId) {
  let bill = await db('bills')
    .where({ tenant_id: tenantId, table_id: tableId })
    .whereIn('status', ['open', 'partially_paid'])
    .first();

  if (!bill) {
    // Auto-generate bill from served orders
    const orders = await db('orders')
      .where({ tenant_id: tenantId, table_id: tableId })
      .whereNotIn('status', ['cancelled'])
      .select('*');

    if (orders.length === 0) return null;

    const orderIds = orders.map((o) => o.id);
    const orderItems = await db('order_items')
      .whereIn('order_id', orderIds)
      .whereNot({ status: 'cancelled' });

    if (orderItems.length === 0) return null;

    const subtotal = orderItems.reduce((sum, i) => sum + parseFloat(i.total_price), 0);
    const tenant = await db('tenants').where({ id: tenantId }).first();
    const taxConfig = tenant.tax_config || { cgst: 2.5, sgst: 2.5 };
    const totals = calculateBillTotals(subtotal, taxConfig, tenant.service_charge_percent || 0, {});

    const billNumber = await getNextBillNumber(tenantId);

    // Get active session
    const session = await db('table_sessions')
      .where({ table_id: tableId, tenant_id: tenantId, status: 'active' })
      .first();

    [bill] = await db('bills')
      .insert({
        tenant_id: tenantId,
        table_id: tableId,
        session_id: session?.id || null,
        bill_number: billNumber,
        ...totals,
        tax_config: JSON.stringify(taxConfig),
        service_charge_percent: tenant.service_charge_percent || 0,
      })
      .returning('*');

    // Insert bill items
    const billItems = orderItems.map((oi) => ({
      bill_id: bill.id,
      order_item_id: oi.id,
      menu_item_name: oi.item_name,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      total_price: oi.total_price,
    }));
    await db('bill_items').insert(billItems);
  }

  const items = await db('bill_items').where({ bill_id: bill.id });
  const payments = await db('payments').where({ bill_id: bill.id }).orderBy('created_at');
  const table = await db('tables').where({ id: tableId }).first();

  return { ...bill, items, payments, table: { number: table?.table_number, label: table?.label } };
}

export async function getBill(tenantId, id) {
  const bill = await db('bills').where({ id, tenant_id: tenantId }).first();
  if (!bill) throw new NotFoundError('Bill');

  const items = await db('bill_items').where({ bill_id: id });
  const payments = await db('payments').where({ bill_id: id }).orderBy('created_at');
  const table = await db('tables').where({ id: bill.table_id }).first();
  const tenant = await db('tenants').where({ id: tenantId }).first();

  return {
    ...bill,
    items,
    payments,
    table: { number: table?.table_number, label: table?.label },
    restaurant: { name: tenant.name, address: tenant.address, phone: tenant.phone },
  };
}

export async function applyDiscount(tenantId, billId, discount) {
  const bill = await db('bills').where({ id: billId, tenant_id: tenantId }).first();
  if (!bill) throw new NotFoundError('Bill');
  if (bill.status === 'paid') throw new ValidationError('Cannot modify a paid bill');

  const taxConfig = bill.tax_config || { cgst: 2.5, sgst: 2.5 };
  const totals = calculateBillTotals(
    parseFloat(bill.subtotal), taxConfig,
    parseFloat(bill.service_charge_percent), discount
  );

  const [updated] = await db('bills')
    .where({ id: billId })
    .update({
      ...totals,
      discount: JSON.stringify(discount),
    })
    .returning('*');

  return updated;
}

export async function setServiceCharge(tenantId, billId, percent) {
  const bill = await db('bills').where({ id: billId, tenant_id: tenantId }).first();
  if (!bill) throw new NotFoundError('Bill');
  if (bill.status === 'paid') throw new ValidationError('Cannot modify a paid bill');

  const discount = bill.discount || {};
  const taxConfig = bill.tax_config || { cgst: 2.5, sgst: 2.5 };
  const totals = calculateBillTotals(parseFloat(bill.subtotal), taxConfig, percent, discount);

  const [updated] = await db('bills')
    .where({ id: billId })
    .update({ ...totals, service_charge_percent: percent })
    .returning('*');

  return updated;
}

export async function recordPayment(tenantId, billId, payment, receivedBy, idempotencyKey = null) {
  // Wrap in transaction for atomicity
  return db.transaction(async (trx) => {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await trx('payments').where({ idempotency_key: idempotencyKey }).first();
      if (existing) return existing;
    }

    const bill = await trx('bills').where({ id: billId, tenant_id: tenantId }).forUpdate().first();
    if (!bill) throw new NotFoundError('Bill');
    if (bill.status === 'paid') throw new ValidationError('Bill is already fully paid');

    const [paymentRecord] = await trx('payments')
      .insert({
        bill_id: billId,
        tenant_id: tenantId,
        amount: payment.amount,
        method: payment.method,
        reference_number: payment.referenceNumber,
        received_by: receivedBy,
        idempotency_key: idempotencyKey,
      })
      .returning('*');

    const newPaidAmount = parseFloat(bill.paid_amount) + payment.amount;
    const billTotal = parseFloat(bill.total);

    let newStatus = 'partially_paid';
    if (newPaidAmount >= billTotal) {
      newStatus = 'paid';
    }

    await trx('bills').where({ id: billId }).update({
      paid_amount: newPaidAmount,
      status: newStatus,
      payment_method: payment.method,
      closed_at: newStatus === 'paid' ? trx.fn.now() : null,
    });

    return paymentRecord;
  });
}

export async function closeBill(tenantId, billId) {
  const bill = await db('bills').where({ id: billId, tenant_id: tenantId }).first();
  if (!bill) throw new NotFoundError('Bill');

  await db('bills').where({ id: billId }).update({
    status: 'closed',
    closed_at: db.fn.now(),
  });

  return { message: 'Bill closed' };
}

/**
 * Quick close for cafe mode: one-tap close table.
 * Marks all orders as served, generates/closes bill, frees table.
 */
export async function quickCloseTable(tenantId, tableId) {
  return db.transaction(async (trx) => {
    // Bulk-mark all active orders as served (single UPDATE, not N loop)
    const activeOrderIds = await trx('orders')
      .where({ tenant_id: tenantId, table_id: tableId })
      .whereNotIn('status', ['served', 'cancelled'])
      .pluck('id');

    if (activeOrderIds.length > 0) {
      await trx('orders').whereIn('id', activeOrderIds).update({ status: 'served' });
      await trx('order_items')
        .whereIn('order_id', activeOrderIds)
        .whereNot({ status: 'cancelled' })
        .update({ status: 'served' });
    }

    // Fetch all non-cancelled orders (includes just-served ones)
    const allOrders = await trx('orders')
      .where({ tenant_id: tenantId, table_id: tableId })
      .whereNot({ status: 'cancelled' })
      .select('id', 'total', 'tax_amount');

    if (allOrders.length === 0) {
      // Nothing ordered — just free the table
      await trx('tables').where({ id: tableId, tenant_id: tenantId }).update({ status: 'available' });
      await trx('table_sessions')
        .where({ table_id: tableId, tenant_id: tenantId, status: 'active' })
        .update({ status: 'closed', closed_at: trx.fn.now() });
      return { message: 'Table closed (no orders)' };
    }

    const orderIds = allOrders.map((o) => o.id);
    const orderItems = await trx('order_items')
      .whereIn('order_id', orderIds)
      .whereNot({ status: 'cancelled' });

    const subtotal = orderItems.reduce((sum, i) => sum + parseFloat(i.total_price), 0);
    const tenant = await trx('tenants').where({ id: tenantId }).first();
    const taxConfig = tenant.tax_config || { cgst: 2.5, sgst: 2.5 };
    const taxRate = (taxConfig.cgst || 0) + (taxConfig.sgst || 0) + (taxConfig.vat || 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Check for existing open bill
    let bill = await trx('bills')
      .where({ tenant_id: tenantId, table_id: tableId })
      .whereIn('status', ['open', 'partially_paid'])
      .first();

    if (!bill) {
      const billNumber = ((await trx('bills').where({ tenant_id: tenantId }).max('bill_number as max'))[0]?.max || 0) + 1;
      const session = await trx('table_sessions')
        .where({ table_id: tableId, tenant_id: tenantId, status: 'active' }).first();

      [bill] = await trx('bills').insert({
        tenant_id: tenantId, table_id: tableId, session_id: session?.id || null,
        bill_number: billNumber, subtotal, tax_amount: taxAmount, total,
        tax_config: JSON.stringify(taxConfig), status: 'closed', closed_at: trx.fn.now(),
      }).returning('*');

      const billItems = orderItems.map((oi) => ({
        bill_id: bill.id, order_item_id: oi.id,
        menu_item_name: oi.item_name, quantity: oi.quantity,
        unit_price: oi.unit_price, total_price: oi.total_price,
      }));
      if (billItems.length) await trx('bill_items').insert(billItems);
    } else {
      await trx('bills').where({ id: bill.id }).update({
        subtotal, tax_amount: taxAmount, total, status: 'closed', closed_at: trx.fn.now(),
      });
    }

    // Free table
    await trx('tables').where({ id: tableId, tenant_id: tenantId }).update({ status: 'available' });
    await trx('table_sessions')
      .where({ table_id: tableId, tenant_id: tenantId, status: 'active' })
      .update({ status: 'closed', closed_at: trx.fn.now() });

    return { message: 'Table closed', bill };
  });
}

export async function getPrintBill(tenantId, billId) {
  const bill = await getBill(tenantId, billId);
  const taxConfig = bill.tax_config || {};
  const branding = await db('tenant_branding').where({ tenant_id: tenantId }).first();

  const lines = [
    '================================',
    `     ${bill.restaurant.name}`,
    bill.restaurant.address ? `     ${bill.restaurant.address}` : null,
    bill.restaurant.phone ? `     ${bill.restaurant.phone}` : null,
    '================================',
    `Bill #: ${bill.bill_number}`,
    `Table: ${bill.table.number}${bill.table.label ? ` (${bill.table.label})` : ''}`,
    `Date: ${new Date(bill.created_at).toLocaleDateString()}    Time: ${new Date(bill.created_at).toLocaleTimeString()}`,
    '--------------------------------',
    'Item          Qty   Price  Total',
    '--------------------------------',
    ...bill.items.map((item) =>
      `${item.menu_item_name.padEnd(14).slice(0, 14)} ${String(item.quantity).padStart(3)}  ${String(item.unit_price).padStart(6)} ${String(item.total_price).padStart(6)}`
    ),
    '--------------------------------',
    `Subtotal:              ${String(bill.subtotal).padStart(8)}`,
  ].filter(Boolean);

  if (parseFloat(bill.discount_amount) > 0) {
    const disc = bill.discount || {};
    lines.push(`Discount${disc.type === 'percent' ? ` (${disc.value}%)` : ''}:     -${String(bill.discount_amount).padStart(8)}`);
  }

  if (taxConfig.cgst) lines.push(`CGST (${taxConfig.cgst}%):           +${String((parseFloat(bill.tax_amount) / 2).toFixed(2)).padStart(8)}`);
  if (taxConfig.sgst) lines.push(`SGST (${taxConfig.sgst}%):           +${String((parseFloat(bill.tax_amount) / 2).toFixed(2)).padStart(8)}`);
  if (taxConfig.vat) lines.push(`VAT (${taxConfig.vat}%):            +${String(bill.tax_amount).padStart(8)}`);

  if (parseFloat(bill.service_charge) > 0) {
    lines.push(`Service (${bill.service_charge_percent}%):      +${String(bill.service_charge).padStart(8)}`);
  }

  lines.push(
    '================================',
    `TOTAL:                 ${String(bill.total).padStart(8)}`,
    '================================',
    bill.payment_method ? `Payment: ${bill.payment_method.toUpperCase()}` : '',
    'Thank you for dining with us!',
    '================================',
  );

  return {
    text: lines.filter(Boolean).join('\n'),
    bill,
    logoUrl: branding?.logo_url || null,
    brandColors: {
      primary: branding?.primary_color,
      accent: branding?.accent_color,
    },
  };
}

export async function listBills(tenantId, filters = {}) {
  let query = db('bills').where({ tenant_id: tenantId });

  if (filters.status) query = query.where({ status: filters.status });
  if (filters.from) query = query.where('created_at', '>=', filters.from);
  if (filters.to) query = query.where('created_at', '<=', filters.to);

  const page = parseInt(filters.page, 10) || 1;
  const limit = Math.min(parseInt(filters.limit, 10) || 20, 100);

  const [{ count }] = await query.clone().count();
  const bills = await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    data: bills,
    meta: { total: parseInt(count, 10), page, limit },
  };
}

export async function addTip(tenantId, billId, tipAmount) {
  const bill = await db('bills').where({ id: billId, tenant_id: tenantId }).first();
  if (!bill) throw new NotFoundError('Bill');

  const newTotal = parseFloat(bill.total) - parseFloat(bill.tip_amount || 0) + tipAmount;

  const [updated] = await db('bills')
    .where({ id: billId })
    .update({ tip_amount: tipAmount, total: newTotal })
    .returning('*');

  return updated;
}

export async function getHtmlReceipt(tenantId, billId) {
  const bill = await getBill(tenantId, billId);
  const branding = await db('tenant_branding').where({ tenant_id: tenantId }).first();
  const primaryColor = branding?.primary_color || '#1a1a2e';
  const accentColor = branding?.accent_color || '#e94560';

  const itemRows = (bill.items || []).map((item) =>
    `<tr><td>${item.menu_item_name}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">₹${parseFloat(item.unit_price).toFixed(2)}</td><td style="text-align:right">₹${parseFloat(item.total_price).toFixed(2)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt #${bill.bill_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;max-width:400px;margin:auto;padding:20px;color:#333}
.header{text-align:center;padding:20px 0;border-bottom:2px solid ${primaryColor}}.header h1{font-size:1.3rem;color:${primaryColor}}
.header p{font-size:.8rem;color:#666;margin-top:4px}.meta{display:flex;justify-content:space-between;padding:12px 0;font-size:.85rem;border-bottom:1px dashed #ccc}
table{width:100%;border-collapse:collapse;margin:12px 0}th{text-align:left;padding:8px 4px;border-bottom:1px solid #eee;font-size:.75rem;color:#888;text-transform:uppercase}
td{padding:6px 4px;font-size:.85rem;border-bottom:1px solid #f5f5f5}.totals{border-top:2px solid #eee;padding-top:12px}
.totals .row{display:flex;justify-content:space-between;padding:4px 0;font-size:.85rem}.totals .total{font-weight:bold;font-size:1.1rem;color:${primaryColor};border-top:2px solid ${primaryColor};padding-top:8px;margin-top:8px}
.footer{text-align:center;padding:20px 0;font-size:.75rem;color:#999}
${branding?.logo_url ? `.logo{width:50px;height:50px;object-fit:contain;margin:0 auto 8px}` : ''}
@media print{body{max-width:100%}}</style></head>
<body>
<div class="header">
${branding?.logo_url ? `<img src="${branding.logo_url}" alt="" class="logo">` : ''}
<h1>${bill.restaurant?.name || 'Restaurant'}</h1>
${bill.restaurant?.address ? `<p>${bill.restaurant.address}</p>` : ''}
${bill.restaurant?.phone ? `<p>${bill.restaurant.phone}</p>` : ''}
</div>
<div class="meta"><span>Bill #${bill.bill_number}</span><span>Table ${bill.table?.number || '-'}</span></div>
<div class="meta"><span>${new Date(bill.created_at).toLocaleDateString()}</span><span>${new Date(bill.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${itemRows}</tbody></table>
<div class="totals">
<div class="row"><span>Subtotal</span><span>₹${parseFloat(bill.subtotal).toFixed(2)}</span></div>
${parseFloat(bill.discount_amount) > 0 ? `<div class="row" style="color:green"><span>Discount</span><span>-₹${parseFloat(bill.discount_amount).toFixed(2)}</span></div>` : ''}
<div class="row"><span>Tax</span><span>₹${parseFloat(bill.tax_amount).toFixed(2)}</span></div>
${parseFloat(bill.service_charge) > 0 ? `<div class="row"><span>Service Charge</span><span>₹${parseFloat(bill.service_charge).toFixed(2)}</span></div>` : ''}
${parseFloat(bill.tip_amount || 0) > 0 ? `<div class="row"><span>Tip</span><span>₹${parseFloat(bill.tip_amount).toFixed(2)}</span></div>` : ''}
<div class="row total"><span>Total</span><span>₹${parseFloat(bill.total).toFixed(2)}</span></div>
${bill.payment_method ? `<div class="row"><span>Paid via</span><span>${bill.payment_method.toUpperCase()}</span></div>` : ''}
</div>
<div class="footer">Thank you for dining with us!<br>Powered by RestaurantOS</div>
</body></html>`;
}
