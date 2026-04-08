import { useState, useEffect } from 'react';
import { get } from '../../api/client';
import { TrendingUp, DollarSign, ShoppingCart, Star, Clock } from 'lucide-react';
import { ListSkeleton } from '../../components/ui/Skeleton';

export default function Analytics() {
  const [period, setPeriod] = useState('daily');
  const [revenue, setRevenue] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [popular, setPopular] = useState([]);
  const [categorySales, setCategorySales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [rev, orders, pop, cats] = await Promise.all([
          get(`/analytics/revenue?period=${period}`),
          get(`/analytics/orders?period=${period}`),
          get('/analytics/popular-items?limit=10'),
          get('/analytics/category-sales'),
        ]);
        setRevenue(rev);
        setOrderStats(orders);
        setPopular(Array.isArray(pop) ? pop : []);
        setCategorySales(Array.isArray(cats) ? cats : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [period]);

  if (loading) return <div className="p-6"><ListSkeleton rows={10} /></div>;

  const totalCatRevenue = categorySales.reduce((s, c) => s + parseFloat(c.total_revenue || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['daily', 'weekly', 'monthly'].map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-md text-sm capitalize ${period === p ? 'bg-white shadow-sm font-medium' : ''}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={DollarSign} label="Total Revenue" value={`₹${revenue?.summary?.totalRevenue?.toLocaleString() || 0}`} color="text-green-600" />
        <MetricCard icon={ShoppingCart} label="Total Orders" value={orderStats?.total_orders || 0} color="text-blue-600" />
        <MetricCard icon={TrendingUp} label="Avg Order Value" value={`₹${parseFloat(orderStats?.avg_order_value || 0).toFixed(0)}`} color="text-purple-600" />
        <MetricCard icon={Star} label="Completion Rate"
          value={`${orderStats?.total_orders > 0 ? Math.round((orderStats.completed_orders / orderStats.total_orders) * 100) : 0}%`}
          color="text-orange-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Revenue Trend</h3>
          <div className="space-y-2">
            {(revenue?.data || []).slice(-10).map((r, i) => {
              const maxRevenue = Math.max(...(revenue?.data || []).map((d) => parseFloat(d.total_revenue)));
              const width = maxRevenue > 0 ? (parseFloat(r.total_revenue) / maxRevenue) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20">
                    {new Date(r.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div className="bg-green-500 h-4 rounded-full transition-all" style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-xs font-medium w-16 text-right">₹{parseFloat(r.total_revenue).toLocaleString()}</span>
                </div>
              );
            })}
            {(revenue?.data || []).length === 0 && <p className="text-sm text-gray-400">No data</p>}
          </div>
        </div>

        {/* Popular items */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Top Items</h3>
          <div className="space-y-3">
            {popular.map((item, i) => (
              <div key={item.menu_item_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{item.item_name}</p>
                    <p className="text-xs text-gray-500">{item.order_count} orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{item.total_quantity} sold</p>
                  <p className="text-xs text-gray-500">₹{parseFloat(item.total_revenue).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Category Sales</h3>
          <div className="space-y-3">
            {categorySales.map((cat) => {
              const pct = totalCatRevenue > 0 ? (parseFloat(cat.total_revenue) / totalCatRevenue) * 100 : 0;
              return (
                <div key={cat.category_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{cat.category_name}</span>
                    <span className="font-medium">₹{parseFloat(cat.total_revenue).toLocaleString()} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Orders by hour */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Orders by Hour</h3>
          <div className="flex items-end gap-1 h-40">
            {Array.from({ length: 24 }, (_, h) => {
              const hourData = orderStats?.hourlyDistribution?.find((d) => d.hour === h);
              const count = parseInt(hourData?.count || 0, 10);
              const maxCount = Math.max(...(orderStats?.hourlyDistribution || []).map((d) => parseInt(d.count, 10)));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '120px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-blue-400 rounded-t transition-all"
                      style={{ height: `${height}%` }}
                      title={`${h}:00 — ${count} orders`}
                    />
                  </div>
                  {h % 4 === 0 && <span className="text-[10px] text-gray-400">{h}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color} bg-gray-50 mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
