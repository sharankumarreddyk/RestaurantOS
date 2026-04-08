import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, Table2, ClipboardList,
  Receipt, BarChart3, Users, Settings, LogOut, ChefHat,
  Store, Package, CalendarDays,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../ui/NotificationBell';

const roleMenus = {
  super_admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/restaurants', icon: Store, label: 'Restaurants' },
    { to: '/admin/users', icon: Users, label: 'Users' },
  ],
  owner: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/tables', icon: Table2, label: 'Tables' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
    { to: '/billing', icon: Receipt, label: 'Billing' },
    { to: '/reservations', icon: CalendarDays, label: 'Reservations' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/staff', icon: Users, label: 'Staff' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ],
  manager: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/tables', icon: Table2, label: 'Tables' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
    { to: '/billing', icon: Receipt, label: 'Billing' },
    { to: '/reservations', icon: CalendarDays, label: 'Reservations' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/staff', icon: Users, label: 'Staff' },
  ],
  waiter: [
    { to: '/tables', icon: Table2, label: 'Tables' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
  ],
  chef: [
    { to: '/kitchen', icon: ChefHat, label: 'Kitchen' },
  ],
  counter: [
    { to: '/billing', icon: Receipt, label: 'Billing' },
    { to: '/orders', icon: ClipboardList, label: 'Orders' },
  ],
  // Cafe-specific menus (selected based on businessType)
  cafe_operator: [
    { to: '/cafe', icon: LayoutDashboard, label: 'Table Tracker' },
  ],
  cafe_owner: [
    { to: '/cafe', icon: LayoutDashboard, label: 'Table Tracker' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/tables', icon: Table2, label: 'Tables' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const isCafe = user?.businessType === 'cafe';

  // For cafe mode, use cafe-specific menus
  let items;
  if (isCafe && user?.role === 'cafe_operator') {
    items = roleMenus.cafe_operator;
  } else if (isCafe && user?.role === 'owner') {
    items = roleMenus.cafe_owner;
  } else {
    items = roleMenus[user?.role] || [];
  }

  return (
    <aside className="hidden md:flex md:flex-col w-60 bg-white border-r min-h-screen">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary">RestaurantOS</h1>
          <NotificationBell />
        </div>
        <p className="text-xs text-gray-500 mt-1 capitalize">{user?.role?.replace('_', ' ')}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t">
        <div className="px-3 py-2 text-sm text-gray-600 truncate">{user?.name}</div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
