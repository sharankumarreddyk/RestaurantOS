import { useState, useEffect } from 'react';
import { Calendar, Users, Clock, Plus, Phone } from 'lucide-react';
import { get, post, put } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

export default function ReservationsPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    partySize: 2, date: new Date().toISOString().split('T')[0], time: '19:00',
    notes: '',
  });
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      const data = await get('/reservations/today');
      setOverview(data);
    } catch {
      addToast('Failed to load reservations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      await post('/reservations', form);
      await fetchData();
      setShowForm(false);
      addToast('Reservation created', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await put(`/reservations/${id}/status`, { status });
      await fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAddWaitlist = async () => {
    try {
      await post('/waitlist', {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        partySize: parseInt(form.partySize, 10),
        date: new Date().toISOString().split('T')[0],
        notes: form.notes,
      });
      await fetchData();
      setShowForm(false);
      addToast('Added to waitlist', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const stats = overview?.stats;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reservations</h1>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium">
          <Plus size={16} className="inline mr-1" /> New Booking
        </button>
      </div>

      {/* Today's stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold">{parseInt(stats.total, 10)}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600">{parseInt(stats.confirmed, 10)}</p>
            <p className="text-xs text-gray-500">Confirmed</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">{parseInt(stats.seated, 10)}</p>
            <p className="text-xs text-gray-500">Seated</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-red-600">{parseInt(stats.no_shows, 10)}</p>
            <p className="text-xs text-gray-500">No-shows</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold">{parseInt(stats.total_covers, 10) || 0}</p>
            <p className="text-xs text-gray-500">Total Covers</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reservations */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Reservations</h2>
          <div className="space-y-2">
            {(overview?.reservations || []).map((r) => (
              <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-sm">{r.customer_name}</span>
                    <span className="text-xs text-gray-500 ml-2 flex items-center gap-1 inline-flex">
                      <Phone size={10} /> {r.customer_phone}
                    </span>
                  </div>
                  <Badge variant={r.status}>{r.status}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock size={12} /> {r.reservation_time?.slice(0, 5)}</span>
                  <span className="flex items-center gap-1"><Users size={12} /> {r.party_size} guests</span>
                </div>
                {r.notes && <p className="text-xs text-gray-400 mt-1">{r.notes}</p>}
                <div className="flex gap-2 mt-3">
                  {r.status === 'pending' && (
                    <button onClick={() => handleStatusChange(r.id, 'confirmed')}
                      className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">Confirm</button>
                  )}
                  {(r.status === 'pending' || r.status === 'confirmed') && (
                    <button onClick={() => handleStatusChange(r.id, 'seated')}
                      className="px-3 py-1 bg-green-50 text-green-600 rounded text-xs font-medium">Seat</button>
                  )}
                  {r.status === 'seated' && (
                    <button onClick={() => handleStatusChange(r.id, 'completed')}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">Complete</button>
                  )}
                  {r.status !== 'cancelled' && r.status !== 'completed' && (
                    <button onClick={() => handleStatusChange(r.id, r.status === 'confirmed' ? 'no_show' : 'cancelled')}
                      className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-medium">
                      {r.status === 'confirmed' ? 'No-show' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(overview?.reservations || []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No reservations today</p>
            )}
          </div>
        </div>

        {/* Waitlist */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Waitlist</h2>
          <div className="space-y-2">
            {(overview?.waitlist || []).map((w) => (
              <div key={w.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold inline-flex items-center justify-center mr-2">
                      {w.waitlist_position}
                    </span>
                    <span className="font-medium text-sm">{w.customer_name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{w.party_size} guests</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-amber-600">~{w.estimated_wait_minutes} min wait</span>
                  <button onClick={() => handleStatusChange(w.id, 'seated')}
                    className="px-3 py-1 bg-green-50 text-green-600 rounded text-xs font-medium">Seat Now</button>
                </div>
              </div>
            ))}
            {(overview?.waitlist || []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Waitlist empty</p>
            )}
          </div>
        </div>
      </div>

      {/* Create form */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Booking">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Guest Name</label>
              <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Party Size</label>
              <input type="number" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Birthday celebration, window seat"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 bg-accent text-white py-2.5 rounded-lg text-sm font-medium">
              Create Reservation
            </button>
            <button onClick={handleAddWaitlist} className="flex-1 border py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Add to Waitlist
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
