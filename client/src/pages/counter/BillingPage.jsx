import { useState, useEffect } from 'react';
import { get, post, put } from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Receipt, Printer, CreditCard, Banknote, Smartphone } from 'lucide-react';

export default function BillingPage() {
  const [bills, setBills] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', referenceNumber: '' });
  const [discountForm, setDiscountForm] = useState({ type: 'percent', value: '', reason: '' });
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      const [billsData, tablesData] = await Promise.all([
        get('/bills?status=open'),
        get('/tables'),
      ]);
      setBills(billsData?.data || []);
      setTables(Array.isArray(tablesData) ? tablesData : []);
    } catch (err) {
      addToast('Failed to load billing data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getTableBill = async (tableId) => {
    try {
      const bill = await get(`/bills/table/${tableId}`);
      if (bill) {
        setSelectedBill(bill);
      } else {
        addToast('No bill for this table', 'info');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handlePayment = async () => {
    try {
      await post(`/bills/${selectedBill.id}/payment`, {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
      });
      addToast('Payment recorded', 'success');
      setShowPayment(false);
      // Refresh bill
      const updated = await get(`/bills/${selectedBill.id}`);
      setSelectedBill(updated);
      fetchData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDiscount = async () => {
    try {
      await put(`/bills/${selectedBill.id}/discount`, {
        type: discountForm.type,
        value: parseFloat(discountForm.value),
        reason: discountForm.reason,
      });
      addToast('Discount applied', 'success');
      setShowDiscount(false);
      const updated = await get(`/bills/${selectedBill.id}`);
      setSelectedBill(updated);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handlePrint = async () => {
    try {
      const { text } = await get(`/bills/${selectedBill.id}/print`);
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`<pre style="font-family:monospace;font-size:14px;">${text}</pre>`);
      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      addToast('Print failed', 'error');
    }
  };

  const occupiedTables = tables.filter((t) => t.status === 'occupied');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Table list for billing */}
        <div className="md:col-span-1">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">OCCUPIED TABLES</h2>
          <div className="space-y-2">
            {occupiedTables.map((table) => (
              <button
                key={table.id}
                onClick={() => getTableBill(table.id)}
                className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">Table {table.table_number}</span>
                  <Badge variant="occupied">Occupied</Badge>
                </div>
                {table.label && <p className="text-xs text-gray-500 mt-1">{table.label}</p>}
              </button>
            ))}
            {occupiedTables.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No occupied tables</p>
            )}
          </div>

          <h2 className="text-sm font-semibold text-gray-500 mt-6 mb-3">RECENT BILLS</h2>
          <div className="space-y-2">
            {bills.slice(0, 10).map((bill) => (
              <button
                key={bill.id}
                onClick={async () => {
                  const full = await get(`/bills/${bill.id}`);
                  setSelectedBill(full);
                }}
                className="w-full text-left bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between text-sm">
                  <span>Bill #{bill.bill_number}</span>
                  <Badge variant={bill.status}>{bill.status}</Badge>
                </div>
                <p className="text-sm font-bold mt-1">₹{parseFloat(bill.total).toFixed(0)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Bill detail */}
        <div className="md:col-span-2">
          {selectedBill ? (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Bill #{selectedBill.bill_number}</h2>
                  <p className="text-sm text-gray-500">
                    Table {selectedBill.table?.number} {selectedBill.table?.label ? `(${selectedBill.table.label})` : ''}
                  </p>
                </div>
                <Badge variant={selectedBill.status}>{selectedBill.status}</Badge>
              </div>

              {/* Items */}
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-center p-3">Qty</th>
                      <th className="text-right p-3">Price</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedBill.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3">{item.menu_item_name}</td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right">₹{parseFloat(item.unit_price).toFixed(0)}</td>
                        <td className="p-3 text-right">₹{parseFloat(item.total_price).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{parseFloat(selectedBill.subtotal).toFixed(2)}</span></div>
                {parseFloat(selectedBill.discount_amount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span><span>-₹{parseFloat(selectedBill.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>Tax</span><span>₹{parseFloat(selectedBill.tax_amount).toFixed(2)}</span></div>
                {parseFloat(selectedBill.service_charge) > 0 && (
                  <div className="flex justify-between"><span>Service Charge</span><span>₹{parseFloat(selectedBill.service_charge).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span><span>₹{parseFloat(selectedBill.total).toFixed(2)}</span>
                </div>
                {parseFloat(selectedBill.paid_amount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span><span>₹{parseFloat(selectedBill.paid_amount).toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(selectedBill.total) - parseFloat(selectedBill.paid_amount) > 0 && selectedBill.status !== 'paid' && (
                  <div className="flex justify-between font-medium text-red-600">
                    <span>Due</span><span>₹{(parseFloat(selectedBill.total) - parseFloat(selectedBill.paid_amount)).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Payments */}
              {selectedBill.payments?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Payments</h4>
                  {selectedBill.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1">
                      <span className="capitalize">{p.method}</span>
                      <span>₹{parseFloat(p.amount).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              {selectedBill.status !== 'paid' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => {
                    setPaymentForm({
                      amount: (parseFloat(selectedBill.total) - parseFloat(selectedBill.paid_amount)).toFixed(2),
                      method: 'cash',
                      referenceNumber: '',
                    });
                    setShowPayment(true);
                  }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
                    <CreditCard size={16} /> Record Payment
                  </button>
                  <button onClick={() => setShowDiscount(true)}
                    className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                    Apply Discount
                  </button>
                  <button onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                    <Printer size={16} /> Print
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
              <Receipt size={48} strokeWidth={1} className="mx-auto mb-4" />
              <p>Select a table or bill to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Record Payment">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount (₹)</label>
            <input type="number" value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Payment Method</label>
            <div className="flex gap-2">
              {[
                { value: 'cash', icon: Banknote, label: 'Cash' },
                { value: 'card', icon: CreditCard, label: 'Card' },
                { value: 'upi', icon: Smartphone, label: 'UPI' },
              ].map((m) => (
                <button key={m.value}
                  onClick={() => setPaymentForm({ ...paymentForm, method: m.value })}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border text-sm ${paymentForm.method === m.value ? 'border-accent bg-accent/10' : ''}`}>
                  <m.icon size={20} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {paymentForm.method !== 'cash' && (
            <div>
              <label className="block text-sm font-medium mb-1">Reference Number</label>
              <input value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          )}
          <button onClick={handlePayment} className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium">
            Confirm Payment
          </button>
        </div>
      </Modal>

      {/* Discount modal */}
      <Modal isOpen={showDiscount} onClose={() => setShowDiscount(false)} title="Apply Discount">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setDiscountForm({ ...discountForm, type: 'percent' })}
              className={`flex-1 py-2 rounded-lg border text-sm ${discountForm.type === 'percent' ? 'border-accent bg-accent/10' : ''}`}>
              Percentage (%)
            </button>
            <button onClick={() => setDiscountForm({ ...discountForm, type: 'fixed' })}
              className={`flex-1 py-2 rounded-lg border text-sm ${discountForm.type === 'fixed' ? 'border-accent bg-accent/10' : ''}`}>
              Fixed (₹)
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {discountForm.type === 'percent' ? 'Percentage' : 'Amount (₹)'}
            </label>
            <input type="number" value={discountForm.value}
              onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason (optional)</label>
            <input value={discountForm.reason}
              onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <button onClick={handleDiscount} className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium">
            Apply Discount
          </button>
        </div>
      </Modal>
    </div>
  );
}
