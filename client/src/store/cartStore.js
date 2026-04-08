import { create } from 'zustand';

// Restore cart from localStorage
function loadCart() {
  try {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : { items: [], tableId: null };
  } catch {
    return { items: [], tableId: null };
  }
}

function saveCart(state) {
  try {
    localStorage.setItem('cart', JSON.stringify({ items: state.items, tableId: state.tableId }));
  } catch {
    // Storage full or unavailable — non-fatal
  }
}

const initial = loadCart();

const useCartStore = create((set, get) => ({
  items: initial.items,
  tableId: initial.tableId,

  setTableId: (id) => {
    set({ tableId: id });
    saveCart(get());
  },

  addItem: (menuItem, variant, customizations, quantity = 1, notes = '') => {
    const { items } = get();
    const key = `${menuItem.id}_${variant?.id || 'base'}_${JSON.stringify(customizations)}`;

    const existing = items.find((i) => i.key === key);
    if (existing) {
      const updated = {
        items: items.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        ),
      };
      set(updated);
      saveCart(get());
      return;
    }

    let unitPrice = variant ? parseFloat(variant.price) : parseFloat(menuItem.base_price);
    const customizationTotal = (customizations || []).reduce(
      (sum, c) => sum + (c.priceAdjustment || 0), 0
    );
    unitPrice += customizationTotal;

    set({
      items: [
        ...items,
        {
          key,
          menuItemId: menuItem.id,
          name: menuItem.name,
          variantId: variant?.id || null,
          variantName: variant?.name || null,
          customizations: customizations || [],
          quantity,
          unitPrice,
          notes,
          imageUrl: menuItem.thumbnail_url || menuItem.image_url,
          foodType: menuItem.food_type,
        },
      ],
    });
    saveCart(get());
  },

  updateQuantity: (key, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter((i) => i.key !== key) });
    } else {
      set({
        items: get().items.map((i) => (i.key === key ? { ...i, quantity } : i)),
      });
    }
    saveCart(get());
  },

  removeItem: (key) => {
    set({ items: get().items.filter((i) => i.key !== key) });
    saveCart(get());
  },

  clear: () => {
    set({ items: [] });
    localStorage.removeItem('cart');
  },

  getTotal: () => {
    return get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));

export default useCartStore;
