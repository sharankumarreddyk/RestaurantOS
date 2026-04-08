import { useState, useEffect } from 'react';
import { Package, AlertTriangle, Plus, ArrowUpDown } from 'lucide-react';
import { get, post, put } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ListSkeleton } from '../../components/ui/Skeleton';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAdjust, setShowAdjust] = useState(null);
  const [form, setForm] = useState({ name: '', unit: 'kg', currentStock: 0, lowStockThreshold: 0, costPerUnit: 0 });
  const [adjustForm, setAdjustForm] = useState({ changeAmount: 0, reason: 'restock' });
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      const [inv, alerts] = await Promise.all([
        get('/inventory?limit=100'),
        get('/inventory/low-stock'),
      ]);
      setItems(inv?.data || []);
      setLowStock(Array.isArray(alerts) ? alerts : []);
    } catch (err) {
      addToast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      await post('/inventory', form);
      await fetchData();
      setShowForm(false);
      setForm({ name: '', unit: 'kg', currentStock: 0, lowStockThreshold: 0, costPerUnit: 0 });
      addToast('Item added', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAdjust = async () => {
    try {
      await put(`/inventory/${showAdjust.id}/stock`, adjustForm);
      await fetchData();
      setShowAdjust(null);
      addToast('Stock updated', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <div className="p-6"><ListSkeleton rows={8} /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium">
          <Plus size={16} className="inline mr-1" /> Add Item
        </button>
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
            <AlertTriangle size={16} /> Low Stock Alerts ({lowStock.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((item) => (
              <span key={item.id} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                {item.name}: {parseFloat(item.current_stock).toFixed(1)} {item.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inventory table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-sm text-gray-500">
            <tr>
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Unit</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-right p-3">Threshold</th>
              <th className="text-right p-3">Cost/Unit</th>
              <th className="text-center p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const isLow = parseFloat(item.current_stock) <= parseFloat(item.low_stock_threshold);
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-sm">{item.name}</td>
                  <td className="p-3 text-sm text-gray-500">{item.unit}</td>
                  <td className="p-3 text-sm text-right">{parseFloat(item.current_stock).toFixed(1)}</td>
                  <td className="p-3 text-sm text-right text-gray-500">{parseFloat(item.low_stock_threshold).toFixed(1)}</td>
                  <td className="p-3 text-sm text-right">₹{parseFloat(item.cost_per_unit).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <Badge variant={isLow ? 'cancelled' : 'available'}>{isLow ? 'Low' : 'OK'}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => { setShowAdjust(item); setAdjustForm({ changeAmount: 0, reason: 'restock' }); }}
                      className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50">
                      <ArrowUpDown size={12} className="inline mr-1" /> Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <div className="text-center py-12 text-gray-400">No inventory items</div>}
      </div>

      {/* Create form */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Inventory Item">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                {['kg', 'g', 'liters', 'ml', 'pieces', 'packets', 'bottles', 'dozen'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Current Stock</label>
              <input type="number" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Low Stock Alert</label>
              <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cost per Unit (₹)</label>
              <input type="number" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <button onClick={handleCreate} className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium">Create</button>
        </div>
      </Modal>

      {/* Adjust stock */}
      <Modal isOpen={!!showAdjust} onClose={() => setShowAdjust(null)} title={`Adjust: ${showAdjust?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Current stock: <strong>{parseFloat(showAdjust?.current_stock || 0).toFixed(1)} {showAdjust?.unit}</strong>
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Change Amount (negative to deduct)</label>
            <input type="number" value={adjustForm.changeAmount}
              onChange={(e) => setAdjustForm({ ...adjustForm, changeAmount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <select value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              {['restock', 'waste', 'adjustment', 'order'].map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <button onClick={handleAdjust} className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium">
            Update Stock
          </button>
        </div>
      </Modal>
    </div>
  );
}
