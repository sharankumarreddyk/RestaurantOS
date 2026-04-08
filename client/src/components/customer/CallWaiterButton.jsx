import { useState } from 'react';
import { HandHelping, Receipt } from 'lucide-react';
import { post } from '../../api/client';
import useAuthStore from '../../store/authStore';

export default function CallWaiterButton() {
  const { user } = useAuthStore();
  const [cooldown, setCooldown] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (user?.role !== 'customer') return null;

  const handleCall = async (type) => {
    if (cooldown) return;
    setCooldown(true);
    setShowOptions(false);

    try {
      await post('/notifications/call-waiter', { type });
      setFeedback(type === 'bill' ? 'Bill requested!' : 'Waiter called!');

      // Vibrate on mobile
      try { navigator.vibrate?.(200); } catch {}

      setTimeout(() => setFeedback(null), 4000);
      setTimeout(() => setCooldown(false), 60000); // 60s cooldown
    } catch {
      setFeedback('Failed — try again');
      setTimeout(() => { setFeedback(null); setCooldown(false); }, 3000);
    }
  };

  return (
    <>
      {/* Feedback toast */}
      {feedback && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium animate-slide-up">
          {feedback}
        </div>
      )}

      {/* Options popover */}
      {showOptions && (
        <div className="fixed bottom-24 right-4 z-50 bg-white rounded-xl shadow-xl border p-2 space-y-1 animate-fade-in">
          <button
            onClick={() => handleCall('waiter')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-sm font-medium"
            aria-label="Call waiter"
          >
            <HandHelping size={18} className="text-blue-500" aria-hidden="true" />
            Call Waiter
          </button>
          <button
            onClick={() => handleCall('bill')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-sm font-medium"
            aria-label="Request bill"
          >
            <Receipt size={18} className="text-green-500" aria-hidden="true" />
            Request Bill
          </button>
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => {
          if (cooldown) return;
          setShowOptions(!showOptions);
        }}
        disabled={cooldown}
        className={`fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
          cooldown
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 active:scale-95'
        }`}
        aria-label="Call waiter or request bill"
        aria-expanded={showOptions}
      >
        <HandHelping size={20} className="text-white" aria-hidden="true" />
      </button>

      {/* Backdrop to close options */}
      {showOptions && (
        <div className="fixed inset-0 z-30" onClick={() => setShowOptions(false)} aria-hidden="true" />
      )}
    </>
  );
}
