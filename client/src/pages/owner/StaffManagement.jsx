import { useState, useEffect } from 'react';
import { get, post, put, del } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Plus, Edit2, Trash2, UserCircle } from 'lucide-react';

export default function StaffManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'waiter' });
  const { addToast } = useToast();

  const fetchUsers = async () => {
    try {
      const data = await get('/users');
      setUsers(data?.data || []);
    } catch (err) {
      addToast('Failed to load staff', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    try {
      await post('/auth/register', form);
      await fetchUsers();
      setShowForm(false);
      setForm({ name: '', email: '', password: '', phone: '', role: 'waiter' });
      addToast('Staff member created', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await put(`/users/${user.id}`, { isActive: !user.is_active });
      await fetchUsers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await del(`/users/${id}`);
      await fetchUsers();
      addToast('Staff member removed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const roleColors = {
    owner: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    waiter: 'bg-green-100 text-green-700',
    chef: 'bg-orange-100 text-orange-700',
    counter: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Staff</h1>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium">
          <Plus size={16} className="inline mr-1" /> Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <UserCircle size={24} className="text-gray-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{user.name}</h3>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[user.role] || 'bg-gray-100'}`}>
                {user.role}
              </span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className={`text-xs ${user.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
              <div className="flex gap-1">
                <button onClick={() => handleToggleActive(user)}
                  className="p-2 text-gray-400 hover:text-blue-600 text-xs">
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(user.id)}
                  className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Staff Member">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              {['manager', 'waiter', 'chef', 'counter'].map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <button onClick={handleCreate} className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium">
            Create Staff Member
          </button>
        </div>
      </Modal>
    </div>
  );
}
