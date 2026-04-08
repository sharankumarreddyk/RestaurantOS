import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Volume2, VolumeX, ShoppingCart, ChefHat, HandHelping, Receipt, AlertCircle } from 'lucide-react';
import useNotificationStore from '../../store/notificationStore';
import useWebSocket from '../../hooks/useWebSocket';
import useAuthStore from '../../store/authStore';

const typeIcons = {
  order_new: ChefHat,
  order_ready: Check,
  order_confirmed: CheckCheck,
  order_preparing: ChefHat,
  order_served: CheckCheck,
  call_waiter: HandHelping,
  call_bill: Receipt,
  bill_paid: Receipt,
};

const priorityColors = {
  high: 'border-l-red-500',
  urgent: 'border-l-red-600',
  normal: 'border-l-blue-400',
  low: 'border-l-gray-300',
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const {
    notifications, unreadCount, soundEnabled,
    fetchNotifications, fetchUnreadCount, addNotification,
    markRead, markAllRead, toggleSound,
  } = useNotificationStore();
  const { user } = useAuthStore();

  // Initial fetch only — WebSocket handles real-time updates (no polling)
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  // WebSocket: listen for notification:new
  const onWsMessage = useCallback((msg) => {
    if (msg.type === 'notification:new' && msg.payload) {
      // Filter: only show notifications relevant to this user's role
      const n = msg.payload;
      if (n.target_user_id && n.target_user_id !== user?.userId) return;
      if (n.target_role && n.target_role !== user?.role) {
        // Check if user should see this role's notifications
        const visible = {
          owner: ['owner', 'manager', 'waiter', 'chef', 'counter'],
          manager: ['manager', 'waiter', 'chef', 'counter'],
        };
        if (!(visible[user?.role] || [user?.role]).includes(n.target_role)) return;
      }
      addNotification(n);
    }
  }, [user, addNotification]);

  useWebSocket(onWsMessage);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={20} className="text-gray-600" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] bg-white rounded-xl shadow-xl border z-50 flex flex-col animate-fade-in"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSound}
                className="p-1.5 rounded-md hover:bg-gray-100"
                aria-label={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} className="text-gray-400" />}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Bell size={24} className="mx-auto mb-2 opacity-40" aria-hidden="true" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcons[n.type] || AlertCircle;
                return (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.is_read) markRead(n.id); }}
                    className={`w-full text-left px-4 py-3 border-b border-l-4 hover:bg-gray-50 transition-colors ${
                      n.is_read ? 'border-l-transparent bg-white' : `${priorityColors[n.priority] || priorityColors.normal} bg-blue-50/30`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        n.is_read ? 'bg-gray-100' : 'bg-blue-100'
                      }`}>
                        <Icon size={14} className={n.is_read ? 'text-gray-400' : 'text-blue-600'} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${n.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                          {n.title}
                        </p>
                        {n.body && <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" aria-label="Unread" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
