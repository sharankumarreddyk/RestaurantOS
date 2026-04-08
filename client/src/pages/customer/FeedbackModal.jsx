import { useState } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { post } from '../../api/client';
import { useBranding } from '../../components/customer/BrandingProvider';

export default function FeedbackModal({ isOpen, onClose, orderId, tableId, sessionId }) {
  const { restaurant } = useBranding() || {};
  const [ratings, setRatings] = useState({ overall: 0, food: 0, service: 0, ambience: 0 });
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (ratings.overall === 0) return;
    setSubmitting(true);
    try {
      await post('/feedback', {
        orderId, tableId, sessionId,
        overallRating: ratings.overall,
        foodRating: ratings.food || undefined,
        serviceRating: ratings.service || undefined,
        ambienceRating: ratings.ambience || undefined,
        comment: comment || undefined,
        googleReviewPrompted: ratings.overall >= 4,
      });
      setSubmitted(true);
    } catch {
      // silent — feedback failure shouldn't annoy the customer
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const StarRow = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => onChange(s)} aria-label={`${s} stars`}
            className="p-0.5">
            <Star size={24} className={s <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
          </button>
        ))}
      </div>
    </div>
  );

  if (submitted) {
    // If high rating → prompt Google Review
    if (ratings.overall >= 4 && restaurant?.googleReviewUrl) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-fade-in">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold mb-2">Thank you!</h3>
            <p className="text-sm text-muted mb-4">We're glad you enjoyed your experience. Would you share it on Google?</p>
            <a href={restaurant.googleReviewUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium mb-3">
              <ExternalLink size={14} /> Leave a Google Review
            </a>
            <br />
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">Maybe later</button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-fade-in">
          <div className="text-4xl mb-3">🙏</div>
          <h3 className="text-lg font-semibold mb-2">Thank you for your feedback!</h3>
          <p className="text-sm text-muted mb-4">Your response helps us improve.</p>
          <button onClick={onClose} className="px-6 py-2 bg-accent text-white rounded-lg text-sm">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up">
        <h3 className="text-lg font-semibold mb-1">How was your experience?</h3>
        <p className="text-sm text-muted mb-4">Your feedback helps {restaurant?.name || 'us'} improve</p>

        <div className="space-y-4">
          <StarRow label="Overall" value={ratings.overall} onChange={(v) => setRatings({ ...ratings, overall: v })} />
          <StarRow label="Food" value={ratings.food} onChange={(v) => setRatings({ ...ratings, food: v })} />
          <StarRow label="Service" value={ratings.service} onChange={(v) => setRatings({ ...ratings, service: v })} />
          <StarRow label="Ambience" value={ratings.ambience} onChange={(v) => setRatings({ ...ratings, ambience: v })} />

          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Any comments? (optional)" maxLength={1000}
            className="w-full p-3 border rounded-xl text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-accent" />

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm">Skip</button>
            <button onClick={handleSubmit} disabled={ratings.overall === 0 || submitting}
              className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
