import { useState, useEffect } from 'react';
import { get, post, put, del } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Plus, Store, Users, ShoppingCart, DollarSign, Edit2, Trash2 } from 'lucide-react';

export default function SuperAdmin() {
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', address: '', phone: '', email: '',
    businessType: 'restaurant',
    ownerName: '', ownerEmail: '', ownerPassword: '',
  });
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      const [s, t] = await Promise.all([
        get('/admin/stats'),
        get('/admin/tenants'),
      ]);
      setStats(s);
      setTenants(t?.data || []);
    } catch (err) {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      await post('/admin/tenants', form);
      await fetchData();
      setShowCreateForm(false);
      setForm({ name: '', slug: '', address: '', phone: '', email: '', ownerName: '', ownerEmail: '', ownerPassword: '' });
      addToast('Restaurant created', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      await put(`/admin/tenants/${id}`, { isActive: !isActive });
      await fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await del(`/admin/tenants/${id}`);
      await fetchData();
      addToast('Restaurant deleted', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Platform Admin</h1>
        <button onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium">
          <Plus size={16} className="inline mr-1" /> Add Restaurant
        </button>
      </div>

      {/* Global stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Store} label="Restaurants" value={stats.tenants} color="bg-purple-100 text-purple-700" />
          <StatCard icon={Users} label="Total Users" value={stats.users} color="bg-blue-100 text-blue-700" />
          <StatCard icon={ShoppingCart} label="Total Orders" value={stats.orders} color="bg-green-100 text-green-700" />
          <StatCard icon={DollarSign} label="Total Revenue" value={`₹${stats.totalRevenue?.toLocaleString()}`} color="bg-orange-100 text-orange-700" />
        </div>
      )}

      {/* Restaurant list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-sm text-gray-500">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Slug</th>
              <th className="text-left p-3 hidden md:table-cell">Contact</th>
              <th className="text-center p-3">Status</th>
              <th className="text-left p-3 hidden md:table-cell">Created</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="p-3 font-medium text-sm">{t.name}</td>
                <td className="p-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.business_type === 'cafe' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {t.business_type === 'cafe' ? '☕ Cafe' : '🍽️ Restaurant'}
                  </span>
                </td>
                <td className="p-3 text-sm text-gray-500">{t.slug}</td>
                <td className="p-3 text-sm text-gray-500 hidden md:table-cell">{t.phone || t.email || '-'}</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggleActive(t.id, t.is_active)}>
                    <Badge variant={t.is_active ? 'available' : 'cancelled'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </td>
                <td className="p-3 text-sm text-gray-500 hidden md:table-cell">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => handleDelete(t.id)} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && <div className="text-center py-12 text-gray-400">No restaurants</div>}
      </div>

      {/* Create form */}
      <Modal isOpen={showCreateForm} onClose={() => setShowCreateForm(false)} title="Create Restaurant" size="lg">
        <div className="space-y-4">
          {/* Business Type Selector — THE key choice */}
          <div className="mb-2">
            <label className="block text-sm font-medium mb-2">Business Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setForm({ ...form, businessType: 'restaurant' })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  form.businessType === 'restaurant'
                    ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-2xl block mb-1">🍽️</span>
                <span className="font-semibold text-sm">Restaurant</span>
                <p className="text-[10px] text-gray-500 mt-1">Full-service with waiters, kitchen, billing</p>
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, businessType: 'cafe' })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  form.businessType === 'cafe'
                    ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-2xl block mb-1">☕</span>
                <span className="font-semibold text-sm">Cafe / Lounge</span>
                <p className="text-[10px] text-gray-500 mt-1">Counter-service, 1-2 staff, simple menu</p>
              </button>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-500">
            {form.businessType === 'cafe' ? 'CAFE DETAILS' : 'RESTAURANT DETAILS'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL-friendly)</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-500 pt-2">OWNER ACCOUNT</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Owner Name</label>
              <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Owner Email</label>
              <input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Owner Password</label>
              <input type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <button onClick={handleCreate} className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium">
            Create Restaurant
          </button>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color} mb-2`}>
        <Icon size={16} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
