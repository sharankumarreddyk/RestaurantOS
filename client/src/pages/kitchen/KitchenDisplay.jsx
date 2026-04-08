import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, ChefHat, CheckCircle2, AlertCircle } from 'lucide-react';
import { get, put, debounce } from '../../api/client';
import useWebSocket from '../../hooks/useWebSocket';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const audioRef = useRef(null);

  const fetchOrders = async () => {
    try {
      const data = await get('/orders/kitchen');
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  // Debounced refetch — prevents storm when multiple orders update rapidly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetch = useCallback(debounce(() => fetchOrders(), 600), []);

  const onWsMessage = useCallback((msg) => {
    if (msg.type === 'order:new' || msg.type === 'order:updated') {
      debouncedFetch();
      // Play notification sound (immediate, not debounced)
      try { audioRef.current?.play(); } catch {}
      addToast('New order received!', 'info');
    } else if (msg.type === 'order:status') {
      debouncedFetch();
    }
  }, [debouncedFetch, addToast]);

  useWebSocket(onWsMessage);

  const updateOrderStatus = async (orderId, status) => {
    try {
      await put(`/orders/${orderId}/status`, { status });
      fetchOrders();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const updateItemStatus = async (orderId, itemId, status) => {
    try {
      await put(`/orders/${orderId}/items/${itemId}/status`, { status });
      fetchOrders();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const getTimeColor = (minutes) => {
    if (minutes < 10) return 'text-green-400';
    if (minutes < 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const newOrders = orders.filter((o) => o.status === 'pending' || o.status === 'confirmed');
  const preparing = orders.filter((o) => o.status === 'preparing');
  const ready = orders.filter((o) => o.status === 'ready');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hidden audio for notification */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRl9vT19teleGFtcGxlAAAA" type="audio/wav" />
      </audio>

      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat size={24} />
          <h1 className="text-xl font-bold">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-400" /> New: {newOrders.length}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-400" /> Cooking: {preparing.length}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-400" /> Ready: {ready.length}
          </span>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {/* New Orders */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-yellow-400 flex items-center gap-2">
            <AlertCircle size={18} /> New Orders
          </h2>
          <div className="space-y-3">
            {newOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAccept={() => updateOrderStatus(order.id, order.status === 'pending' ? 'confirmed' : 'preparing')}
                onItemStatus={updateItemStatus}
                acceptLabel={order.status === 'pending' ? 'Confirm' : 'Start Cooking'}
                getTimeColor={getTimeColor}
              />
            ))}
            {newOrders.length === 0 && <EmptyColumn />}
          </div>
        </div>

        {/* Preparing */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-orange-400 flex items-center gap-2">
            <ChefHat size={18} /> Preparing
          </h2>
          <div className="space-y-3">
            {preparing.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onItemStatus={updateItemStatus}
                getTimeColor={getTimeColor}
              />
            ))}
            {preparing.length === 0 && <EmptyColumn />}
          </div>
        </div>

        {/* Ready */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-green-400 flex items-center gap-2">
            <CheckCircle2 size={18} /> Ready
          </h2>
          <div className="space-y-3">
            {ready.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onServe={() => updateOrderStatus(order.id, 'served')}
                getTimeColor={getTimeColor}
              />
            ))}
            {ready.length === 0 && <EmptyColumn />}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onAccept, onServe, onItemStatus, acceptLabel, getTimeColor }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-bold">#{order.order_number}</span>
          <span className="text-gray-400 text-sm ml-2">
            Table {order.table?.table_number || '?'}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-sm ${getTimeColor(order.minutesElapsed)}`}>
          <Clock size={14} />
          {order.minutesElapsed}m
        </div>
      </div>

      <div className="space-y-2">
        {order.items?.map((item) => {
          const customizations = typeof item.customizations === 'string'
            ? JSON.parse(item.customizations)
            : item.customizations || [];
          return (
            <div key={item.id} className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{item.quantity}x {item.item_name}</span>
                </div>
                {customizations.length > 0 && (
                  <p className="text-xs text-yellow-400 mt-0.5">
                    {customizations.map((c) => c.optionName).join(', ')}
                  </p>
                )}
                {item.notes && <p className="text-xs text-gray-500 mt-0.5">Note: {item.notes}</p>}
              </div>
              {onItemStatus && item.status !== 'ready' && item.status !== 'served' && (
                <button
                  onClick={() => onItemStatus(
                    order.id,
                    item.id,
                    item.status === 'pending' ? 'preparing' : 'ready'
                  )}
                  className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  {item.status === 'pending' ? 'Cook' : 'Done'}
                </button>
              )}
              {item.status === 'ready' && (
                <CheckCircle2 size={16} className="text-green-400 mt-1" />
              )}
            </div>
          );
        })}
      </div>

      {order.notes && (
        <div className="text-xs text-amber-300 bg-amber-900/30 p-2 rounded">
          Note: {order.notes}
        </div>
      )}

      <div className="flex gap-2">
        {onAccept && (
          <button
            onClick={onAccept}
            className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            {acceptLabel}
          </button>
        )}
        {onServe && (
          <button
            onClick={onServe}
            className="flex-1 bg-green-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            Mark Served
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyColumn() {
  return (
    <div className="text-center py-8 text-gray-600 text-sm">
      No orders
    </div>
  );
}
