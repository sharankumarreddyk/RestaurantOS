import db from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { cacheDel } from '../../config/redis.js';

export async function listCombos(tenantId) {
  const combos = await db('combo_deals')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at')
    .orderBy('sort_order');

  const comboIds = combos.map((c) => c.id);
  const items = comboIds.length
    ? await db('combo_items')
        .whereIn('combo_id', comboIds)
        .join('menu_items', 'combo_items.menu_item_id', 'menu_items.id')
        .select('combo_items.*', 'menu_items.name as item_name', 'menu_items.base_price', 'menu_items.image_url')
    : [];

  return combos.map((c) => ({
    ...c,
    items: items.filter((i) => i.combo_id === c.id),
  }));
}

export async function createCombo(tenantId, data) {
  return db.transaction(async (trx) => {
    // Calculate original price from items
    let originalPrice = 0;
    for (const item of data.items) {
      const menuItem = await trx('menu_items').where({ id: item.menuItemId }).first();
      if (menuItem) originalPrice += parseFloat(menuItem.base_price) * (item.quantity || 1);
    }

    const [combo] = await trx('combo_deals')
      .insert({
        tenant_id: tenantId,
        name: data.name,
        description: data.description,
        image_url: data.imageUrl,
        combo_price: data.comboPrice,
        original_price: originalPrice,
        is_active: data.isActive !== false,
        valid_from: data.validFrom || null,
        valid_to: data.validTo || null,
      })
      .returning('*');

    if (data.items?.length) {
      await trx('combo_items').insert(
        data.items.map((i) => ({
          combo_id: combo.id,
          menu_item_id: i.menuItemId,
          variant_id: i.variantId || null,
          quantity: i.quantity || 1,
        }))
      );
    }

    await cacheDel(`menu:${tenantId}`);
    return { ...combo, original_price: originalPrice };
  });
}

export async function updateCombo(tenantId, id, data) {
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.comboPrice !== undefined) updates.combo_price = data.comboPrice;
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  if (data.validFrom !== undefined) updates.valid_from = data.validFrom;
  if (data.validTo !== undefined) updates.valid_to = data.validTo;

  const [combo] = await db('combo_deals')
    .where({ id, tenant_id: tenantId })
    .update(updates)
    .returning('*');
  if (!combo) throw new NotFoundError('Combo deal');

  await cacheDel(`menu:${tenantId}`);
  return combo;
}

export async function deleteCombo(tenantId, id) {
  await db('combo_deals').where({ id, tenant_id: tenantId }).update({ deleted_at: db.fn.now() });
  await cacheDel(`menu:${tenantId}`);
}
