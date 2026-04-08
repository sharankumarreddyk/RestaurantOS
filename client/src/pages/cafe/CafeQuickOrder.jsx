import { useState, useEffect } from 'react';
import { X, Plus, Minus, Search } from 'lucide-react';
import { get, post } from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { FoodTypeBadge } from '../../components/ui/Badge';

export default function CafeQuickOrder({ table, onClose, onOrderPlaced }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // [{menuItem, quantity}]
  const [placing, setPlacing] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    get('/menu/items?limit=100')
      .then((data) => setItems((data?.data || []).filter((i) => i.is_available)))
      .catch(() => addToast('Failed to load items', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const addToCart = (item) => {
    const existing = cart.find((c) => c.menuItem.id === item.id);
    if (existing) {
      setCart(cart.map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
  };

  const updateQty = (itemId, delta) => {
    setCart(cart
      .map((c) => c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c)
      .filter((c) => c.quantity > 0)
    );
  };

  const total = cart.reduce((s, c) => s + parseFloat(c.menuItem.base_price) * c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const idempotencyKey = `cafe_${table.id}_${Date.now()}`;
      await post('/orders', {
        tableId: table.id,
        orderType: 'dine_in',
        items: cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          customizations: [],
        })),
      }, { idempotencyKey });
      addToast(`Order placed for Table ${table.table_number}`, 'success');
      onOrderPlaced();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="presentation">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-slide-up"
        role="dialog" aria-modal="true" aria-label={`Quick order for table ${table.table_number}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold">Quick Order — Table {table.table_number}</h2>
            {table.label && <p className="text-xs text-gray-500">{table.label}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm outline-none"
              autoFocus />
          </div>
        </div>

        {/* Item grid — flat, fast */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading items...</div>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-2">
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.menuItem.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`p-3 rounded-lg text-left text-sm transition-colors ${
                      inCart ? 'bg-accent/10 border border-accent' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <FoodTypeBadge type={item.food_type} />
                      {inCart && (
                        <span className="bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {inCart.quantity}
                        </span>
                      )}
                    </div>
                    <p className="font-medium mt-1 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">₹{parseFloat(item.base_price).toFixed(0)}</p>
                  </button>
                );
              })}
              {filteredItems.length === 0 && (
                <p className="col-span-2 text-center py-8 text-gray-400">No items found</p>
              )}
            </div>
          )}
        </div>

        {/* Cart summary */}
        {cart.length > 0 && (
          <div className="border-t bg-gray-50 p-3">
            <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
              {cart.map((c) => (
                <div key={c.menuItem.id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{c.menuItem.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => updateQty(c.menuItem.id, -1)}
                      className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-200"
                      aria-label="Decrease quantity">
                      <Minus size={10} />
                    </button>
                    <span className="w-4 text-center font-medium">{c.quantity}</span>
                    <button onClick={() => updateQty(c.menuItem.id, 1)}
                      className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-200"
                      aria-label="Increase quantity">
                      <Plus size={10} />
                    </button>
                    <span className="w-12 text-right text-xs">₹{(parseFloat(c.menuItem.base_price) * c.quantity).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={placeOrder} disabled={placing}
              className="w-full bg-accent text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50">
              {placing ? 'Placing...' : `Place Order — ₹${total.toFixed(0)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
