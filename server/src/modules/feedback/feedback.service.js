import db from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';

export async function submitFeedback(tenantId, data) {
  const [feedback] = await db('customer_feedback')
    .insert({
      tenant_id: tenantId,
      order_id: data.orderId || null,
      table_id: data.tableId || null,
      session_id: data.sessionId || null,
      overall_rating: data.overallRating,
      food_rating: data.foodRating,
      service_rating: data.serviceRating,
      ambience_rating: data.ambienceRating,
      comment: data.comment,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      google_review_prompted: data.googleReviewPrompted || false,
    })
    .returning('*');
  return feedback;
}

export async function listFeedback(tenantId, { from, to, minRating, page = 1, limit = 20 } = {}) {
  let query = db('customer_feedback').where({ tenant_id: tenantId });
  if (from) query = query.where('created_at', '>=', from);
  if (to) query = query.where('created_at', '<=', to);
  if (minRating) query = query.where('overall_rating', '>=', minRating);

  const [{ count }] = await query.clone().count();
  const data = await query
    .orderBy('created_at', 'desc')
    .limit(Math.min(limit, 100))
    .offset((page - 1) * limit);

  return { data, meta: { total: parseInt(count, 10), page, limit } };
}

export async function getFeedbackStats(tenantId, { from, to } = {}) {
  let query = db('customer_feedback').where({ tenant_id: tenantId });
  if (from) query = query.where('created_at', '>=', from);
  if (to) query = query.where('created_at', '<=', to);

  const stats = await query
    .select(
      db.raw('COUNT(*) as total_reviews'),
      db.raw('ROUND(AVG(overall_rating), 1) as avg_overall'),
      db.raw('ROUND(AVG(food_rating), 1) as avg_food'),
      db.raw('ROUND(AVG(service_rating), 1) as avg_service'),
      db.raw('ROUND(AVG(ambience_rating), 1) as avg_ambience'),
      db.raw('COUNT(*) FILTER (WHERE overall_rating >= 4) as positive_count'),
      db.raw('COUNT(*) FILTER (WHERE overall_rating <= 2) as negative_count'),
    )
    .first();

  // Rating distribution
  const distribution = await db('customer_feedback')
    .where({ tenant_id: tenantId })
    .modify((q) => { if (from) q.where('created_at', '>=', from); if (to) q.where('created_at', '<=', to); })
    .select('overall_rating', db.raw('COUNT(*) as count'))
    .groupBy('overall_rating')
    .orderBy('overall_rating');

  return { ...stats, distribution };
}

export async function getGoogleReviewUrl(tenantId) {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  return tenant?.google_review_url || null;
}
