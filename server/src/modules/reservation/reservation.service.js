import db from '../../config/database.js';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors.js';

export async function createReservation(tenantId, data) {
  // Check table availability for the time slot
  if (data.tableId) {
    const conflict = await db('reservations')
      .where({ tenant_id: tenantId, table_id: data.tableId, reservation_date: data.date })
      .whereIn('status', ['pending', 'confirmed'])
      .where('reservation_time', '<=', data.time)
      .whereRaw(`reservation_time + (duration_minutes || ' minutes')::interval >= ?::time`, [data.time])
      .first();
    if (conflict) throw new ConflictError('Table is already reserved for this time slot');
  }

  const [reservation] = await db('reservations')
    .insert({
      tenant_id: tenantId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_email: data.customerEmail,
      party_size: data.partySize,
      reservation_date: data.date,
      reservation_time: data.time,
      duration_minutes: data.durationMinutes || 90,
      table_id: data.tableId || null,
      type: data.type || 'reservation',
      notes: data.notes,
    })
    .returning('*');

  return reservation;
}

export async function listReservations(tenantId, { date, status, type, page = 1, limit = 50 } = {}) {
  let query = db('reservations').where({ tenant_id: tenantId });
  if (date) query = query.where({ reservation_date: date });
  if (status) query = query.where({ status });
  if (type) query = query.where({ type });

  const [{ count }] = await query.clone().count();
  const data = await query
    .orderBy('reservation_date').orderBy('reservation_time')
    .limit(Math.min(limit, 100))
    .offset((page - 1) * limit);

  return { data, meta: { total: parseInt(count, 10), page, limit } };
}

export async function updateReservationStatus(tenantId, id, status) {
  const [reservation] = await db('reservations')
    .where({ id, tenant_id: tenantId })
    .update({ status })
    .returning('*');
  if (!reservation) throw new NotFoundError('Reservation');

  // If seated, mark the table as occupied
  if (status === 'seated' && reservation.table_id) {
    await db('tables').where({ id: reservation.table_id }).update({ status: 'occupied' });
  }
  if (status === 'completed' && reservation.table_id) {
    await db('tables').where({ id: reservation.table_id }).update({ status: 'available' });
  }

  return reservation;
}

export async function addToWaitlist(tenantId, data) {
  const currentMax = await db('reservations')
    .where({ tenant_id: tenantId, type: 'waitlist', reservation_date: data.date })
    .whereNotIn('status', ['completed', 'cancelled', 'no_show'])
    .max('waitlist_position as max');

  const position = (currentMax[0]?.max || 0) + 1;

  // Estimate wait based on avg table turnover
  const avgTurnover = 45; // minutes — could be dynamic later
  const estimatedWait = position * Math.ceil(avgTurnover / 3); // assume 3 tables turning

  const [entry] = await db('reservations')
    .insert({
      tenant_id: tenantId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      party_size: data.partySize,
      reservation_date: data.date,
      reservation_time: new Date().toTimeString().slice(0, 8),
      type: 'waitlist',
      waitlist_position: position,
      estimated_wait_minutes: estimatedWait,
      notes: data.notes,
    })
    .returning('*');

  return entry;
}

export async function getWaitlist(tenantId, date) {
  return db('reservations')
    .where({ tenant_id: tenantId, type: 'waitlist', reservation_date: date || new Date().toISOString().split('T')[0] })
    .whereNotIn('status', ['completed', 'cancelled', 'no_show', 'seated'])
    .orderBy('waitlist_position');
}

export async function getTodayOverview(tenantId) {
  const today = new Date().toISOString().split('T')[0];

  const reservations = await db('reservations')
    .where({ tenant_id: tenantId, reservation_date: today, type: 'reservation' })
    .whereIn('status', ['pending', 'confirmed', 'seated'])
    .orderBy('reservation_time');

  const waitlist = await getWaitlist(tenantId, today);

  const stats = await db('reservations')
    .where({ tenant_id: tenantId, reservation_date: today })
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed"),
      db.raw("COUNT(*) FILTER (WHERE status = 'seated') as seated"),
      db.raw("COUNT(*) FILTER (WHERE status = 'no_show') as no_shows"),
      db.raw('SUM(party_size) as total_covers'),
    )
    .first();

  return { reservations, waitlist, stats };
}
