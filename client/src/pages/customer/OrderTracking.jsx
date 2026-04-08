import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, ChefHat, Bell } from 'lucide-react';
import { get } from '../../api/client';
import useAuthStore from '../../store/authStore';
import useWebSocket from '../../hooks/useWebSocket';
import Badge from '../../components/ui/Badge';
import BrandedHeader from '../../components/customer/BrandedHeader';
import FeedbackModal from './FeedbackModal';

const statusSteps = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
const statusLabels = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready to Serve',
  served: 'Served',
};

export default function OrderTracking() {
  const { slug } = useParams();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);

  const fetchOrders = async () => {
    try {
      const data = await get(`/orders/active?tableId=${user?.tableId || ''}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const onWsMessage = useCallback((msg) => {
    if (msg.type === 'order:status' || msg.type === 'order:item_status') {
      fetchOrders();
    }
    // Prompt feedback when order is served
    if (msg.type === 'notification:new' && msg.payload?.type === 'order_served') {
      setTimeout(() => setShowFeedback(true), 2000);
    }
  }, []);

  useWebSocket(onWsMessage);

  const getStepIndex = (status) => statusSteps.indexOf(status);

  return (
    <div>
      <BrandedHeader />

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4">
                <div className="skeleton h-6 w-32 mb-3" />
                <div className="skeleton h-4 w-full mb-2" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={48} strokeWidth={1} className="mx-auto mb-4" />
            <p>No active orders</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Order #{order.order_number}</h3>
                <Badge variant={order.status}>{statusLabels[order.status]}</Badge>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-1">
                {statusSteps.slice(0, -1).map((step, i) => {
                  const current = getStepIndex(order.status);
                  const isActive = i <= current;
                  return (
                    <div key={step} className="flex-1 flex items-center gap-1">
                      <div className={`h-1.5 flex-1 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>
                  );
                })}
              </div>

              {/* Items */}
              <div className="space-y-2">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>{item.quantity}x</span>
                      <span>{item.item_name}</span>
                      {item.status === 'ready' && <CheckCircle2 size={14} className="text-green-500" />}
                      {item.status === 'preparing' && <ChefHat size={14} className="text-orange-500" />}
                    </div>
                    <Badge variant={item.status}>{item.status}</Badge>
                  </div>
                ))}
              </div>

              <div className="text-right font-bold text-sm">
                Total: ₹{parseFloat(order.total).toFixed(0)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Post-meal feedback modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        orderId={orders[0]?.id}
        tableId={user?.tableId}
        sessionId={user?.sessionId}
      />

      {/* Manual feedback trigger for served orders */}
      {orders.some((o) => o.status === 'served') && !showFeedback && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowFeedback(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-muted hover:border-accent hover:text-accent transition-colors"
          >
            Rate your experience
          </button>
        </div>
      )}
    </div>
  );
}
