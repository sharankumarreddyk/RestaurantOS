import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ShoppingCart } from 'lucide-react';
import { get, put, post } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import useWebSocket from '../../hooks/useWebSocket';

const statusColors = {
  available: 'bg-green-50 border-green-200 hover:border-green-400',
  occupied: 'bg-red-50 border-red-200 hover:border-red-400',
  reserved: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  cleaning: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400',
};

export default function TableOverview() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTable, setNewTable] = useState({ tableNumber: '', label: '', capacity: 4 });
  const [selectedTable, setSelectedTable] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const fetchTables = async () => {
    try {
      const data = await get('/tables/overview');
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast('Failed to load tables', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTables(); }, []);

  const onWsMessage = useCallback((msg) => {
    if (msg.type === 'table:status' || msg.type === 'order:new' || msg.type === 'order:status') {
      fetchTables();
    }
  }, []);
  useWebSocket(onWsMessage);

  const handleCreateTable = async () => {
    try {
      await post('/tables', {
        tableNumber: parseInt(newTable.tableNumber, 10),
        label: newTable.label || undefined,
        capacity: parseInt(newTable.capacity, 10),
      });
      await fetchTables();
      setShowCreateForm(false);
      setNewTable({ tableNumber: '', label: '', capacity: 4 });
      addToast('Table created', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleStatusChange = async (tableId, status) => {
    try {
      await put(`/tables/${tableId}/status`, { status });
      await fetchTables();
      setSelectedTable(null);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCloseSession = async (tableId) => {
    try {
      await post(`/tables/${tableId}/session/close`);
      await fetchTables();
      setSelectedTable(null);
      addToast('Session closed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleShowQR = async (tableId) => {
    try {
      const qr = await get(`/tables/${tableId}/qr`);
      setShowQR(qr);
    } catch (err) {
      addToast('Failed to generate QR', 'error');
    }
  };

  const summary = {
    total: tables.length,
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tables</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium"
        >
          <Plus size={16} className="inline mr-1" /> Add Table
        </button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-6 text-sm">
        <span className="px-3 py-1 bg-gray-100 rounded-full">Total: {summary.total}</span>
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">Available: {summary.available}</span>
        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full">Occupied: {summary.occupied}</span>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">Reserved: {summary.reserved}</span>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((table) => (
          <div
            key={table.id}
            onClick={() => setSelectedTable(table)}
            className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${statusColors[table.status]}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold">T{table.table_number}</span>
              <Badge variant={table.status}>{table.status}</Badge>
            </div>
            {table.label && <p className="text-xs text-gray-500 mb-1">{table.label}</p>}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users size={12} /> {table.capacity}
            </div>
            {table.activeOrderCount > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-orange-600">
                <ShoppingCart size={12} /> {table.activeOrderCount} orders
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create table modal */}
      <Modal isOpen={showCreateForm} onClose={() => setShowCreateForm(false)} title="Add Table">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Table Number</label>
            <input type="number" value={newTable.tableNumber}
              onChange={(e) => setNewTable({ ...newTable, tableNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Label (optional)</label>
            <input value={newTable.label}
              onChange={(e) => setNewTable({ ...newTable, label: e.target.value })}
              placeholder="e.g. Patio, Window"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capacity</label>
            <input type="number" value={newTable.capacity}
              onChange={(e) => setNewTable({ ...newTable, capacity: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <button onClick={handleCreateTable} className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium">
            Create Table
          </button>
        </div>
      </Modal>

      {/* Table detail modal */}
      <Modal isOpen={!!selectedTable} onClose={() => setSelectedTable(null)} title={`Table ${selectedTable?.table_number}`}>
        {selectedTable && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={selectedTable.status}>{selectedTable.status}</Badge>
              <span className="text-sm text-gray-500">Capacity: {selectedTable.capacity}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {['available', 'occupied', 'reserved', 'cleaning'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(selectedTable.id, status)}
                  disabled={selectedTable.status === status}
                  className={`py-2 rounded-lg text-sm capitalize border ${selectedTable.status === status ? 'bg-gray-100 text-gray-400' : 'hover:bg-gray-50'}`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleShowQR(selectedTable.id)}
                className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                View QR Code
              </button>
              {selectedTable.status === 'occupied' && (
                <button onClick={() => handleCloseSession(selectedTable.id)}
                  className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
                  Close Session
                </button>
              )}
            </div>

            {selectedTable.activeOrders?.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Active Orders</h4>
                {selectedTable.activeOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b text-sm">
                    <span>#{order.order_number}</span>
                    <Badge variant={order.status}>{order.status}</Badge>
                    <span>₹{parseFloat(order.total).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={!!showQR} onClose={() => setShowQR(null)} title="QR Code">
        {showQR && (
          <div className="text-center space-y-4">
            <img src={showQR.dataUrl} alt="Table QR Code" className="mx-auto max-w-[250px]" />
            <p className="text-xs text-gray-500 break-all">{showQR.url}</p>
            <a href={showQR.dataUrl} download="table-qr.png"
              className="inline-block px-6 py-2 bg-accent text-white rounded-lg text-sm">
              Download PNG
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}
