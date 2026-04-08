import { useState, useEffect } from 'react';
import { DollarSign, ShoppingCart, TrendingUp, Users, Table2, ChefHat } from 'lucide-react';
import { get } from '../../api/client';
import { ListSkeleton } from '../../components/ui/Skeleton';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const result = await get('/analytics/dashboard');
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4">
              <div className="skeleton h-4 w-20 mb-2" />
              <div className="skeleton h-8 w-24" />
            </div>
          ))}
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  const stats = [
    {
      label: "Today's Revenue",
      value: `₹${data?.today?.revenue?.toLocaleString() || 0}`,
      icon: DollarSign,
      color: 'bg-green-100 text-green-700',
    },
    {
      label: 'Total Orders',
      value: data?.today?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'Active Orders',
      value: data?.today?.activeOrders || 0,
      icon: ChefHat,
      color: 'bg-orange-100 text-orange-700',
    },
    {
      label: 'Tables Occupied',
      value: `${data?.tables?.occupied || 0} / ${data?.tables?.total || 0}`,
      icon: Table2,
      color: 'bg-purple-100 text-purple-700',
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon size={16} />
              </div>
            </div>
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className="text-xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Avg order value */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Avg. Order Value</span>
              <span className="font-medium">₹{data?.today?.avgOrderValue?.toFixed(0) || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Served Orders</span>
              <span className="font-medium">{data?.today?.servedOrders || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Bills Generated</span>
              <span className="font-medium">{data?.today?.billCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Popular items */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Popular Items Today</h3>
          <div className="space-y-3">
            {(data?.popularItems || []).map((item, i) => (
              <div key={item.menu_item_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-sm">{item.item_name}</span>
                </div>
                <span className="text-sm text-gray-500">{item.total_quantity} sold</span>
              </div>
            ))}
            {(!data?.popularItems || data.popularItems.length === 0) && (
              <p className="text-sm text-gray-400">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
