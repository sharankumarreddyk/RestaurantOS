import { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import useWebSocket from '../../hooks/useWebSocket';
import useAuthStore from '../../store/authStore';

export default function OrderReadyAlert() {
  const [alerts, setAlerts] = useState([]);
  const { user } = useAuthStore();

  const onWsMessage = useCallback((msg) => {
    if (msg.type === 'notification:new' && msg.payload) {
      const n = msg.payload;
      // Only show order_ready and order_confirmed/preparing to customers
      if (['order_ready', 'order_confirmed', 'order_preparing'].includes(n.type)) {
        // Check if targeted to our table
        if (n.target_table_id === user?.tableId || !n.target_table_id) {
          setAlerts((prev) => [n, ...prev.filter((a) => a.id !== n.id)]);

          // Vibrate for order_ready
          if (n.type === 'order_ready') {
            try { navigator.vibrate?.([200, 100, 200]); } catch {}
          }
        }
      }
    }
  }, [user?.tableId]);

  useWebSocket(onWsMessage);

  const dismiss = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Auto-dismiss non-critical alerts after 10s
  useEffect(() => {
    const timers = alerts
      .filter((a) => a.type !== 'order_ready')
      .map((a) => setTimeout(() => dismiss(a.id), 10000));
    return () => timers.forEach(clearTimeout);
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 space-y-2 p-3">
      {alerts.map((alert) => {
        const isReady = alert.type === 'order_ready';
        return (
          <div
            key={alert.id}
            className={`rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 animate-slide-down ${
              isReady
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
            role="alert"
            aria-live="assertive"
          >
            <CheckCircle2 size={20} className="flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{alert.title}</p>
              {alert.body && <p className="text-xs opacity-90 mt-0.5">{alert.body}</p>}
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              className="p-1 rounded-full hover:bg-white/20 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
