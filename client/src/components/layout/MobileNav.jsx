import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, Table2, ClipboardList,
  Receipt, ChefHat, Store, Users, Bell,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';

const roleNavs = {
  super_admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Home' },
    { to: '/admin/restaurants', icon: Store, label: 'Restaurants' },
  ],
  owner: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/tables', icon: Table2, label: 'Tables' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
    { to: '/billing', icon: Receipt, label: 'Bills' },
  ],
  manager: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/tables', icon: Table2, label: 'Tables' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
  ],
  waiter: [
    { to: '/tables', icon: Table2, label: 'Tables' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
  ],
  chef: [
    { to: '/kitchen', icon: ChefHat, label: 'Kitchen' },
  ],
  counter: [
    { to: '/billing', icon: Receipt, label: 'Bills' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
  ],
};

export default function MobileNav() {
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const items = roleNavs[user?.role] || [];

  if (user?.role === 'customer') return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40" role="navigation" aria-label="Main navigation">
      <div className="flex items-center justify-around py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                isActive ? 'text-accent font-medium' : 'text-gray-500'
              }`
            }
          >
            <item.icon size={20} aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
        {/* Notification bell in mobile nav */}
        <div className="relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-gray-500">
          <Bell size={20} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span>Alerts</span>
        </div>
      </div>
    </nav>
  );
}
