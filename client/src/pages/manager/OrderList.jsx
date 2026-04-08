import { useState, useEffect, useCallback } from 'react';
import { get, put } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import useWebSocket from '../../hooks/useWebSocket';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { Clock, Filter } from 'lucide-react';

export default function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const { addToast } = useToast();

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      const data = await get(`/orders?${params}`);
      setOrders(data.data || []);
      setMeta(data.meta);
    } catch (err) {
      addToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter, page]);

  const onWsMessage = useCallback((msg) => {
    if (msg.type?.startsWith('order:')) fetchOrders();
  }, [statusFilter, page]);
  useWebSocket(onWsMessage);

  const updateStatus = async (orderId, status) => {
    try {
      await put(`/orders/${orderId}/status`, { status });
      fetchOrders();
      setSelectedOrder(null);
      addToast(`Order ${status}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const statuses = ['', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Status</option>
            {statuses.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? <ListSkeleton rows={8} /> : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} onClick={() => setSelectedOrder(order)}
              className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold">#{order.order_number}</span>
                  <span className="text-sm text-gray-500">Table {order.table_id?.slice(0, 8)}</span>
                </div>
                <Badge variant={order.status}>{order.status}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{order.items?.length || 0} items</span>
                <span className="font-medium text-gray-900">₹{parseFloat(order.total).toFixed(0)}</span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className="text-center py-12 text-gray-400">No orders found</div>}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total > meta.limit && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}
            className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50">Previous</button>
          <span className="px-4 py-2 text-sm">Page {page} of {Math.ceil(meta.total / meta.limit)}</span>
          <button disabled={page >= Math.ceil(meta.total / meta.limit)} onClick={() => setPage(page + 1)}
            className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Order detail modal */}
      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order #${selectedOrder?.order_number}`} size="lg">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={selectedOrder.status}>{selectedOrder.status}</Badge>
              <span className="text-sm text-gray-500">
                {new Date(selectedOrder.created_at).toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              {selectedOrder.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b text-sm">
                  <div>
                    <span className="font-medium">{item.quantity}x {item.item_name}</span>
                    {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                  </div>
                  <div className="text-right">
                    <Badge variant={item.status}>{item.status}</Badge>
                    <p className="text-sm mt-1">₹{parseFloat(item.total_price).toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{parseFloat(selectedOrder.subtotal).toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>₹{parseFloat(selectedOrder.tax_amount).toFixed(0)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>₹{parseFloat(selectedOrder.total).toFixed(0)}</span></div>
            </div>

            <div className="flex gap-2">
              {selectedOrder.status === 'pending' && (
                <button onClick={() => updateStatus(selectedOrder.id, 'confirmed')}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">Confirm</button>
              )}
              {selectedOrder.status === 'confirmed' && (
                <button onClick={() => updateStatus(selectedOrder.id, 'preparing')}
                  className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">Start Preparing</button>
              )}
              {selectedOrder.status === 'ready' && (
                <button onClick={() => updateStatus(selectedOrder.id, 'served')}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium">Mark Served</button>
              )}
              {!['served', 'cancelled'].includes(selectedOrder.status) && (
                <button onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">Cancel</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
