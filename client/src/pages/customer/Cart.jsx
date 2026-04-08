import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import { post } from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { FoodTypeBadge } from '../../components/ui/Badge';
import { useBranding } from '../../components/customer/BrandingProvider';

export default function Cart() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const cart = useCartStore();
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const brandCtx = useBranding();
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);

  const handlePlaceOrder = async () => {
    if (cart.items.length === 0) return;
    setPlacing(true);
    try {
      const orderData = {
        tableId: user?.tableId || cart.tableId,
        orderType: 'dine_in',
        notes,
        items: cart.items.map((item) => ({
          menuItemId: item.menuItemId,
          variantId: item.variantId,
          quantity: item.quantity,
          customizations: item.customizations,
          notes: item.notes,
        })),
      };

      // Idempotency key prevents duplicate orders on double-submit/retry
      const idempotencyKey = `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await post('/orders', orderData, { idempotencyKey });
      cart.clear();
      addToast('Order placed successfully!', 'success');
      navigate(`/r/${slug}/orders`);
    } catch (err) {
      addToast(err.message || 'Failed to place order', 'error');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="p-4 flex items-center gap-3 border-b sticky top-0 z-10" style={{ backgroundColor: 'var(--page-bg, white)' }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Go back">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        {brandCtx?.branding?.logo_url && (
          <img src={brandCtx.branding.logo_url} alt="" className="w-7 h-7 rounded-md object-contain" />
        )}
        <h1 className="text-lg font-semibold brand-heading">Your Cart</h1>
      </div>

      {cart.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ShoppingCart size={48} strokeWidth={1} />
          <p className="mt-4">Your cart is empty</p>
          <button
            onClick={() => navigate(`/r/${slug}`)}
            className="mt-4 px-6 py-2 bg-accent text-white rounded-full text-sm"
          >
            Browse Menu
          </button>
        </div>
      ) : (
        <>
          <div className="p-4 space-y-3">
            {cart.items.map((item) => (
              <div key={item.key} className="bg-white rounded-xl p-4 flex gap-3">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                    🍽️
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1">
                    <FoodTypeBadge type={item.foodType} />
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                  </div>
                  {item.variantName && (
                    <p className="text-xs text-gray-500">{item.variantName}</p>
                  )}
                  {item.customizations.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {item.customizations.map((c) => c.optionName).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-sm">₹{(item.unitPrice * item.quantity).toFixed(0)}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => cart.updateQuantity(item.key, item.quantity - 1)}
                        className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-500 hover:bg-gray-50"
                      >
                        {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => cart.updateQuantity(item.key, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="px-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for the kitchen (optional)"
              className="w-full p-3 bg-white rounded-xl border text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Summary */}
          <div className="p-4 space-y-2">
            <div className="bg-white rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>₹{cart.getTotal().toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Taxes</span>
                <span className="text-gray-400">Calculated at billing</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>₹{cart.getTotal().toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Place order button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full bg-accent text-white py-3.5 rounded-xl font-medium text-sm disabled:opacity-50"
            >
              {placing ? 'Placing Order...' : `Place Order — ₹${cart.getTotal().toFixed(0)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
