import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get } from '../../api/client';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';

export default function CustomerSession() {
  const { slug, tableId } = useParams();
  const navigate = useNavigate();
  const { setCustomerSession } = useAuthStore();
  const { setTableId } = useCartStore();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initSession() {
      try {
        const data = await get(`/public/session/${slug}/${tableId}`);
        setCustomerSession(data.token, data.session);
        setTableId(tableId);
        navigate(`/r/${slug}`, { replace: true });
      } catch (err) {
        setError(err.message || 'Failed to start session');
      }
    }
    initSession();
  }, [slug, tableId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Please scan the QR code again or ask staff for help.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-gray-500">Setting up your session...</p>
      </div>
    </div>
  );
}
