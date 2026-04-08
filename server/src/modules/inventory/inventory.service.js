import db from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';

export async function listInventory(tenantId, { search, lowStockOnly, page = 1, limit = 50 } = {}) {
  let query = db('inventory_items').where({ tenant_id: tenantId }).whereNull('deleted_at');
  if (search) query = query.where('name', 'ilike', `%${search}%`);
  if (lowStockOnly === 'true') {
    query = query.whereRaw('current_stock <= low_stock_threshold');
  }

  const [{ count }] = await query.clone().count();
  const data = await query.orderBy('name').limit(Math.min(limit, 100)).offset((page - 1) * limit);

  return { data, meta: { total: parseInt(count, 10), page, limit } };
}

export async function createItem(tenantId, data) {
  const [item] = await db('inventory_items')
    .insert({ tenant_id: tenantId, name: data.name, unit: data.unit, current_stock: data.currentStock || 0, low_stock_threshold: data.lowStockThreshold || 0, cost_per_unit: data.costPerUnit || 0 })
    .returning('*');
  return item;
}

export async function updateStock(tenantId, itemId, { changeAmount, reason, userId, referenceId } = {}) {
  return db.transaction(async (trx) => {
    const item = await trx('inventory_items').where({ id: itemId, tenant_id: tenantId }).forUpdate().first();
    if (!item) throw new NotFoundError('Inventory item');

    const newStock = parseFloat(item.current_stock) + changeAmount;
    if (newStock < 0) throw new ValidationError('Insufficient stock');

    await trx('inventory_items').where({ id: itemId }).update({ current_stock: newStock });
    await trx('inventory_logs').insert({
      tenant_id: tenantId, inventory_item_id: itemId,
      change_amount: changeAmount, reason, user_id: userId, reference_id: referenceId,
    });

    // Auto-toggle menu items if stock hits 0
    if (newStock <= 0) {
      const linkedItems = await trx('menu_item_ingredients').where({ inventory_item_id: itemId }).select('menu_item_id');
      if (linkedItems.length > 0) {
        await trx('menu_items')
          .whereIn('id', linkedItems.map((l) => l.menu_item_id))
          .update({ is_available: false });
      }
    }

    return { ...item, current_stock: newStock };
  });
}

export async function linkIngredient(menuItemId, inventoryItemId, quantityNeeded) {
  const [link] = await db('menu_item_ingredients')
    .insert({ menu_item_id: menuItemId, inventory_item_id: inventoryItemId, quantity_needed: quantityNeeded })
    .returning('*');
  return link;
}

export async function getItemIngredients(menuItemId) {
  return db('menu_item_ingredients')
    .where({ menu_item_id: menuItemId })
    .join('inventory_items', 'menu_item_ingredients.inventory_item_id', 'inventory_items.id')
    .select('menu_item_ingredients.*', 'inventory_items.name', 'inventory_items.unit', 'inventory_items.current_stock');
}

export async function getLowStockAlerts(tenantId) {
  return db('inventory_items')
    .where({ tenant_id: tenantId, is_active: true })
    .whereNull('deleted_at')
    .whereRaw('current_stock <= low_stock_threshold')
    .orderBy('current_stock');
}

export async function deductStockForOrder(tenantId, orderItems, orderId) {
  for (const oi of orderItems) {
    const ingredients = await db('menu_item_ingredients').where({ menu_item_id: oi.menu_item_id });
    for (const ing of ingredients) {
      const deduction = parseFloat(ing.quantity_needed) * oi.quantity;
      try {
        await updateStock(tenantId, ing.inventory_item_id, {
          changeAmount: -deduction, reason: 'order', referenceId: orderId,
        });
      } catch (err) {
        // Stock deduction failure shouldn't block the order, but log it
        console.error(`Inventory deduction failed: item=${ing.inventory_item_id} order=${orderId} amount=${deduction}: ${err.message}`);
      }
    }
  }
}
