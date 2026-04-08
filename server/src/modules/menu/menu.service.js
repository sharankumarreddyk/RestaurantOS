import db from '../../config/database.js';
import { cacheGet, cacheSet, cacheDel } from '../../config/redis.js';
import { NotFoundError } from '../../utils/errors.js';
import { slugify } from '../../utils/slugify.js';

// ── Categories ──────────────────────────────────────────

export async function listCategories(tenantId) {
  const categories = await db('menu_categories')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at')
    .orderBy('sort_order')
    .select('*');

  // Build tree structure
  const map = new Map();
  const roots = [];
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }
  for (const cat of categories) {
    const node = map.get(cat.id);
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createCategory(tenantId, data) {
  const slug = slugify(data.name);
  const [category] = await db('menu_categories')
    .insert({
      tenant_id: tenantId,
      name: data.name,
      slug,
      type: data.type,
      parent_id: data.parentId || null,
      image_url: data.imageUrl,
      is_active: data.isActive,
      sort_order: data.sortOrder || 0,
    })
    .returning('*');

  await cacheDel(`menu:${tenantId}`);
  return category;
}

export async function updateCategory(tenantId, id, data) {
  const updates = {};
  if (data.name !== undefined) {
    updates.name = data.name;
    updates.slug = slugify(data.name);
  }
  if (data.type !== undefined) updates.type = data.type;
  if (data.parentId !== undefined) updates.parent_id = data.parentId;
  if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;
  if (data.isActive !== undefined) updates.is_active = data.isActive;

  const [category] = await db('menu_categories')
    .where({ id, tenant_id: tenantId })
    .whereNull('deleted_at')
    .update(updates)
    .returning('*');

  if (!category) throw new NotFoundError('Category');
  await cacheDel(`menu:${tenantId}`);
  return category;
}

export async function deleteCategory(tenantId, id) {
  const result = await db('menu_categories')
    .where({ id, tenant_id: tenantId })
    .update({ deleted_at: db.fn.now() });
  if (!result) throw new NotFoundError('Category');
  await cacheDel(`menu:${tenantId}`);
}

export async function reorderCategories(tenantId, items) {
  await db.transaction(async (trx) => {
    for (const item of items) {
      await trx('menu_categories')
        .where({ id: item.id, tenant_id: tenantId })
        .update({ sort_order: item.sortOrder });
    }
  });
  await cacheDel(`menu:${tenantId}`);
}

// ── Menu Items ──────────────────────────────────────────

export async function listItems(tenantId, filters = {}) {
  let query = db('menu_items')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at');

  if (filters.categoryId) query = query.where({ category_id: filters.categoryId });
  if (filters.foodType) query = query.where({ food_type: filters.foodType });
  if (filters.isAvailable !== undefined) query = query.where({ is_available: filters.isAvailable === 'true' });
  if (filters.search) {
    query = query.where((q) => {
      q.where('name', 'ilike', `%${filters.search}%`)
        .orWhere('description', 'ilike', `%${filters.search}%`);
    });
  }

  const page = parseInt(filters.page, 10) || 1;
  const limit = Math.min(parseInt(filters.limit, 10) || 50, 100);

  const [{ count }] = await query.clone().count();
  const items = await query
    .orderBy('sort_order')
    .limit(limit)
    .offset((page - 1) * limit)
    .select('*');

  return {
    data: items,
    meta: { total: parseInt(count, 10), page, limit },
  };
}

export async function getItem(tenantId, id) {
  const item = await db('menu_items')
    .where({ id, tenant_id: tenantId })
    .whereNull('deleted_at')
    .first();
  if (!item) throw new NotFoundError('Menu item');

  const variants = await db('item_variants').where({ menu_item_id: id }).orderBy('sort_order');
  const customizationGroups = await db('customization_groups').where({ menu_item_id: id }).orderBy('sort_order');

  const groups = await Promise.all(
    customizationGroups.map(async (group) => {
      const options = await db('customization_options').where({ group_id: group.id }).orderBy('sort_order');
      return { ...group, options };
    })
  );

  return { ...item, variants, customizations: groups };
}

export async function createItem(tenantId, data) {
  return db.transaction(async (trx) => {
    const slug = slugify(data.name);
    const [item] = await trx('menu_items')
      .insert({
        tenant_id: tenantId,
        category_id: data.categoryId,
        name: data.name,
        slug,
        description: data.description,
        base_price: data.basePrice,
        prep_time_minutes: data.prepTimeMinutes,
        is_available: data.isAvailable,
        is_popular: data.isPopular,
        is_chef_special: data.isChefSpecial,
        food_type: data.foodType,
        allergens: JSON.stringify(data.allergens || []),
      })
      .returning('*');

    if (data.variants?.length) {
      await trx('item_variants').insert(
        data.variants.map((v, i) => ({
          menu_item_id: item.id,
          name: v.name,
          price: v.price,
          is_default: v.isDefault,
          sort_order: i,
        }))
      );
    }

    if (data.customizations?.length) {
      for (let i = 0; i < data.customizations.length; i++) {
        const group = data.customizations[i];
        const [g] = await trx('customization_groups')
          .insert({
            menu_item_id: item.id,
            name: group.name,
            min_selections: group.minSelections,
            max_selections: group.maxSelections,
            is_required: group.isRequired,
            sort_order: i,
          })
          .returning('*');

        if (group.options?.length) {
          await trx('customization_options').insert(
            group.options.map((opt, j) => ({
              group_id: g.id,
              name: opt.name,
              price_adjustment: opt.priceAdjustment,
              is_default: opt.isDefault,
              sort_order: j,
            }))
          );
        }
      }
    }

    await cacheDel(`menu:${tenantId}`);
    return getItemWithDetails(trx, tenantId, item.id);
  });
}

async function getItemWithDetails(trx, tenantId, id) {
  const item = await trx('menu_items').where({ id, tenant_id: tenantId }).first();
  const variants = await trx('item_variants').where({ menu_item_id: id }).orderBy('sort_order');
  const groups = await trx('customization_groups').where({ menu_item_id: id }).orderBy('sort_order');
  const groupsWithOptions = await Promise.all(
    groups.map(async (g) => ({
      ...g,
      options: await trx('customization_options').where({ group_id: g.id }).orderBy('sort_order'),
    }))
  );
  return { ...item, variants, customizations: groupsWithOptions };
}

export async function updateItem(tenantId, id, data) {
  const updates = {};
  if (data.categoryId !== undefined) updates.category_id = data.categoryId;
  if (data.name !== undefined) {
    updates.name = data.name;
    updates.slug = slugify(data.name);
  }
  if (data.description !== undefined) updates.description = data.description;
  if (data.basePrice !== undefined) updates.base_price = data.basePrice;
  if (data.prepTimeMinutes !== undefined) updates.prep_time_minutes = data.prepTimeMinutes;
  if (data.isAvailable !== undefined) updates.is_available = data.isAvailable;
  if (data.isPopular !== undefined) updates.is_popular = data.isPopular;
  if (data.isChefSpecial !== undefined) updates.is_chef_special = data.isChefSpecial;
  if (data.foodType !== undefined) updates.food_type = data.foodType;
  if (data.allergens !== undefined) updates.allergens = JSON.stringify(data.allergens);
  if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;
  if (data.thumbnailUrl !== undefined) updates.thumbnail_url = data.thumbnailUrl;

  if (Object.keys(updates).length > 0) {
    const [item] = await db('menu_items')
      .where({ id, tenant_id: tenantId })
      .whereNull('deleted_at')
      .update(updates)
      .returning('*');
    if (!item) throw new NotFoundError('Menu item');
  }

  await cacheDel(`menu:${tenantId}`);
  return getItem(tenantId, id);
}

export async function deleteItem(tenantId, id) {
  const result = await db('menu_items')
    .where({ id, tenant_id: tenantId })
    .update({ deleted_at: db.fn.now() });
  if (!result) throw new NotFoundError('Menu item');
  await cacheDel(`menu:${tenantId}`);
}

export async function toggleAvailability(tenantId, id) {
  const item = await db('menu_items').where({ id, tenant_id: tenantId }).first();
  if (!item) throw new NotFoundError('Menu item');

  const [updated] = await db('menu_items')
    .where({ id })
    .update({ is_available: !item.is_available })
    .returning('*');

  await cacheDel(`menu:${tenantId}`);
  return updated;
}

export async function reorderItems(tenantId, items) {
  await db.transaction(async (trx) => {
    for (const item of items) {
      await trx('menu_items')
        .where({ id: item.id, tenant_id: tenantId })
        .update({ sort_order: item.sortOrder });
    }
  });
  await cacheDel(`menu:${tenantId}`);
}

// ── Public Menu (Cached) ────────────────────────────────

export async function getPublicMenu(tenantSlug) {
  const tenant = await db('tenants')
    .where({ slug: tenantSlug, is_active: true })
    .whereNull('deleted_at')
    .first();
  if (!tenant) throw new NotFoundError('Restaurant');

  const cacheKey = `menu:${tenant.id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const branding = await db('tenant_branding').where({ tenant_id: tenant.id }).first();

  let categories = await db('menu_categories')
    .where({ tenant_id: tenant.id, is_active: true })
    .whereNull('deleted_at')
    .orderBy('sort_order');

  // Time-based filtering: hide categories outside their available window
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  categories = categories.filter((cat) => {
    if (!cat.available_from && !cat.available_to) return true;
    if (cat.available_from && cat.available_to) {
      return currentTime >= cat.available_from && currentTime <= cat.available_to;
    }
    if (cat.available_from) return currentTime >= cat.available_from;
    if (cat.available_to) return currentTime <= cat.available_to;
    return true;
  });

  const items = await db('menu_items')
    .where({ tenant_id: tenant.id, is_available: true })
    .whereNull('deleted_at')
    .orderBy('sort_order');

  const itemIds = items.map((i) => i.id);
  const allVariants = itemIds.length
    ? await db('item_variants').whereIn('menu_item_id', itemIds).where({ is_available: true })
    : [];
  const allGroups = itemIds.length
    ? await db('customization_groups').whereIn('menu_item_id', itemIds)
    : [];
  const groupIds = allGroups.map((g) => g.id);
  const allOptions = groupIds.length
    ? await db('customization_options').whereIn('group_id', groupIds).where({ is_available: true })
    : [];

  // Assemble items with their variants and customizations
  const enrichedItems = items.map((item) => ({
    ...item,
    variants: allVariants.filter((v) => v.menu_item_id === item.id),
    customizations: allGroups
      .filter((g) => g.menu_item_id === item.id)
      .map((g) => ({
        ...g,
        options: allOptions.filter((o) => o.group_id === g.id),
      })),
  }));

  // Combo deals (active + within valid dates)
  let combos = await db('combo_deals')
    .where({ tenant_id: tenant.id, is_active: true })
    .whereNull('deleted_at')
    .orderBy('sort_order');

  combos = combos.filter((c) => {
    if (c.valid_from && new Date(c.valid_from) > now) return false;
    if (c.valid_to && new Date(c.valid_to) < now) return false;
    return true;
  });

  const comboIds = combos.map((c) => c.id);
  const comboItemRows = comboIds.length
    ? await db('combo_items')
        .whereIn('combo_id', comboIds)
        .join('menu_items', 'combo_items.menu_item_id', 'menu_items.id')
        .select('combo_items.*', 'menu_items.name as item_name', 'menu_items.image_url', 'menu_items.food_type')
    : [];

  const enrichedCombos = combos.map((c) => ({
    ...c,
    items: comboItemRows.filter((ci) => ci.combo_id === c.id),
    savings: c.original_price ? parseFloat(c.original_price) - parseFloat(c.combo_price) : 0,
  }));

  // Translations (if language requested)
  const translations = {};
  if (tenant.supported_languages?.length > 1) {
    const itemTranslations = await db('menu_item_translations')
      .whereIn('menu_item_id', itemIds);
    const catTranslations = await db('menu_category_translations')
      .whereIn('category_id', categories.map((c) => c.id));

    for (const t of itemTranslations) {
      if (!translations[t.language_code]) translations[t.language_code] = { items: {}, categories: {} };
      translations[t.language_code].items[t.menu_item_id] = { name: t.name, description: t.description };
    }
    for (const t of catTranslations) {
      if (!translations[t.language_code]) translations[t.language_code] = { items: {}, categories: {} };
      translations[t.language_code].categories[t.category_id] = { name: t.name };
    }
  }

  const result = {
    restaurant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      address: tenant.address,
      phone: tenant.phone,
      currency: tenant.currency,
      supportedLanguages: tenant.supported_languages || ['en'],
      defaultLanguage: tenant.default_language || 'en',
      googleReviewUrl: tenant.google_review_url,
    },
    branding,
    categories,
    items: enrichedItems,
    combos: enrichedCombos,
    translations,
  };

  await cacheSet(cacheKey, result, 300); // 5 min TTL
  return result;
}

export async function searchPublicMenu(tenantSlug, query) {
  const tenant = await db('tenants')
    .where({ slug: tenantSlug, is_active: true })
    .first();
  if (!tenant) throw new NotFoundError('Restaurant');

  return db('menu_items')
    .where({ tenant_id: tenant.id, is_available: true })
    .whereNull('deleted_at')
    .where((q) => {
      q.where('name', 'ilike', `%${query}%`)
        .orWhere('description', 'ilike', `%${query}%`);
    })
    .orderBy('is_popular', 'desc')
    .limit(20);
}
