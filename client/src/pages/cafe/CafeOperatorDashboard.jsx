import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Clock, Coffee, DollarSign, Receipt, X, Printer } from 'lucide-react';
import { get, put, post, debounce } from '../../api/client';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import useWebSocket from '../../hooks/useWebSocket';
import CafeQuickOrder from './CafeQuickOrder';

export default function CafeOperatorDashboard() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuickOrder, setShowQuickOrder] = useState(null);
  const [billPreview, setBillPreview] = useState(null); // { tableId, table, items, total, taxAmount }
  const [todayStats, setTodayStats] = useState(null);
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      const [tablesData, stats] = await Promise.all([
        get('/tables/overview'),
        get('/analytics/dashboard').catch(() => null),
      ]);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setTodayStats(stats);
    } catch {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Debounced refetch — prevents flood when multiple WS events fire rapidly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetch = useCallback(debounce(() => fetchData(), 800), []);

  const onWsMessage = useCallback((msg) => {
    if (msg.type?.startsWith('order:') || msg.type === 'table:status' || msg.type === 'notification:new') {
      debouncedFetch();
    }
  }, [debouncedFetch]);
  useWebSocket(onWsMessage);

  const markItemDelivered = async (orderId, itemId) => {
    try {
      await put(`/orders/${orderId}/items/${itemId}/status`, { status: 'served' });
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Step 1: Show bill (calculate total, show to operator to tell customer)
  const showBill = (table) => {
    const allItems = [];
    (table.activeOrders || []).forEach((order) => {
      (order.items || []).forEach((item) => {
        if (item.status !== 'cancelled') {
          allItems.push({ ...item, orderId: order.id });
        }
      });
    });
    const subtotal = allItems.reduce((s, i) => s + parseFloat(i.total_price), 0);
    // Rough tax estimate (5% default) — actual bill generation does precise calc
    const taxAmount = subtotal * 0.05;
    const total = subtotal + taxAmount;

    setBillPreview({
      tableId: table.id,
      tableNumber: table.table_number,
      label: table.label,
      items: allItems,
      subtotal,
      taxAmount,
      total,
    });
  };

  // Step 2: Confirm payment received → close table
  const confirmPaid = async (tableId) => {
    try {
      await post(`/bills/quick-close/${tableId}`);
      setBillPreview(null);
      fetchData();
      addToast('Payment collected — table freed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const getTimeAgo = (dateStr) => {
    const minutes = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const getTableColor = (table) => {
    if (table.status !== 'occupied') return 'border-green-200 bg-green-50';
    const hasAging = table.activeOrders?.some((o) =>
      o.items?.some((i) => i.status !== 'served' && i.status !== 'cancelled' &&
        (Date.now() - new Date(o.created_at).getTime()) > 600000)
    );
    if (hasAging) return 'border-red-300 bg-red-50';
    return 'border-amber-200 bg-amber-50';
  };

  const getTableTotal = (table) => {
    let total = 0;
    (table.activeOrders || []).forEach((order) => {
      (order.items || []).forEach((item) => {
        if (item.status !== 'cancelled') total += parseFloat(item.total_price);
      });
    });
    return total;
  };

  const occupiedTables = tables.filter((t) => t.status === 'occupied');
  const availableTables = tables.filter((t) => t.status !== 'occupied');

  if (loading) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coffee size={24} aria-hidden="true" /> Table Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {occupiedTables.length} occupied / {tables.length} total
          </p>
        </div>
        {todayStats && (
          <div className="flex gap-3">
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm text-center">
              <p className="text-lg font-bold">₹{todayStats.today?.revenue?.toLocaleString() || 0}</p>
              <p className="text-[10px] text-gray-400">Today</p>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm text-center">
              <p className="text-lg font-bold">{todayStats.today?.totalOrders || 0}</p>
              <p className="text-[10px] text-gray-400">Orders</p>
            </div>
          </div>
        )}
      </div>

      {/* Occupied tables — the main view */}
      {occupiedTables.length > 0 && (
        <div className="space-y-4 mb-8">
          {occupiedTables.map((table) => {
            const allItems = [];
            (table.activeOrders || []).forEach((order) => {
              (order.items || []).forEach((item) => {
                allItems.push({ ...item, orderId: order.id, orderTime: order.created_at });
              });
            });
            const total = getTableTotal(table);
            const allDelivered = allItems.length > 0 &&
              allItems.filter((i) => i.status !== 'cancelled').every((i) => i.status === 'served');

            return (
              <div key={table.id} className={`rounded-xl border-2 p-4 ${getTableColor(table)} transition-colors`}>
                {/* Table header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">Table {table.table_number}</span>
                    {table.label && <span className="text-xs text-gray-500">({table.label})</span>}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} aria-hidden="true" />
                      {table.activeOrders?.[0] ? getTimeAgo(table.activeOrders[0].created_at) : ''}
                    </span>
                    {/* Running total badge */}
                    <span className="text-sm font-bold text-gray-700 bg-white px-2 py-0.5 rounded-md">
                      ₹{total.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowQuickOrder(table)}
                      className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium"
                      aria-label={`Add items to table ${table.table_number}`}
                    >
                      <Plus size={12} className="inline mr-1" /> Add
                    </button>
                    <button
                      onClick={() => showBill(table)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        allDelivered
                          ? 'bg-green-600 text-white animate-pulse'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      aria-label={`Show bill for table ${table.table_number}`}
                    >
                      <Receipt size={12} className="inline mr-1" />
                      Bill
                    </button>
                  </div>
                </div>

                {/* Items list */}
                <div className="space-y-1.5">
                  {allItems.filter((i) => i.status !== 'cancelled').map((item) => {
                    const delivered = item.status === 'served';
                    return (
                      <div key={item.id}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                          delivered ? 'bg-white/60 text-gray-400' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => !delivered && markItemDelivered(item.orderId, item.id)}
                            disabled={delivered}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              delivered ? 'bg-green-100 border-green-400' : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                            }`}
                            aria-label={delivered ? 'Delivered' : `Mark ${item.item_name} as delivered`}
                          >
                            {delivered && <Check size={14} className="text-green-600" />}
                          </button>
                          <span className={delivered ? 'line-through' : ''}>{item.quantity}x {item.item_name}</span>
                        </div>
                        <span className="text-xs font-medium">₹{parseFloat(item.total_price).toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>

                {allItems.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">No items ordered yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {occupiedTables.length === 0 && (
        <div className="text-center py-12 mb-8 text-gray-400">
          <Coffee size={40} strokeWidth={1} className="mx-auto mb-3" />
          <p>No active tables — tap a table below to start an order</p>
        </div>
      )}

      {/* Available tables — tap to start order */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Available Tables</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {availableTables.map((table) => (
            <button
              key={table.id}
              onClick={() => setShowQuickOrder(table)}
              className="rounded-xl border-2 border-green-200 bg-green-50 p-3 text-center hover:border-green-400 transition-colors"
              aria-label={`Create order for table ${table.table_number}`}
            >
              <span className="text-lg font-bold">T{table.table_number}</span>
              {table.label && <p className="text-[10px] text-gray-500">{table.label}</p>}
              <p className="text-[10px] text-green-600 font-medium mt-1">
                <Plus size={10} className="inline" /> Order
              </p>
            </button>
          ))}
          {availableTables.length === 0 && (
            <p className="col-span-full text-sm text-gray-400 text-center py-4">All tables occupied</p>
          )}
        </div>
      </div>

      {/* Quick Order Modal */}
      {showQuickOrder && (
        <CafeQuickOrder
          table={showQuickOrder}
          onClose={() => setShowQuickOrder(null)}
          onOrderPlaced={() => { setShowQuickOrder(null); fetchData(); }}
        />
      )}

      {/* Bill Preview + Payment Confirmation Modal */}
      {billPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="presentation">
          <div className="fixed inset-0 bg-black/50" onClick={() => setBillPreview(null)} aria-hidden="true" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm max-h-[85vh] overflow-hidden animate-slide-up"
            role="dialog" aria-modal="true" aria-label="Table bill">

            {/* Bill header */}
            <div className="bg-gray-50 p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Table {billPreview.tableNumber} — Bill</h2>
                {billPreview.label && <p className="text-xs text-gray-500">{billPreview.label}</p>}
              </div>
              <button onClick={() => setBillPreview(null)} className="p-2 rounded-full hover:bg-gray-200"
                aria-label="Close bill">
                <X size={18} />
              </button>
            </div>

            {/* Bill items */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="space-y-2">
                {billPreview.items.map((item, i) => (
                  <div key={item.id || i} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.item_name}</span>
                    <span className="font-medium">₹{parseFloat(item.total_price).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t mt-4 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>₹{billPreview.subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax (5%)</span>
                  <span>₹{billPreview.taxAmount.toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>₹{billPreview.total.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t bg-gray-50 space-y-2">
              <p className="text-xs text-gray-500 text-center mb-2">
                Tell customer the total. Once they pay, tap below to free the table.
              </p>
              <button
                onClick={() => confirmPaid(billPreview.tableId)}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                <DollarSign size={16} />
                Payment Received — ₹{billPreview.total.toFixed(0)}
              </button>
              <button
                onClick={() => setBillPreview(null)}
                className="w-full py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-100"
              >
                Not yet — go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
