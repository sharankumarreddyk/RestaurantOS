export function paginate(query, { page = 1, limit = 20 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  return {
    query: query.limit(l).offset(offset),
    meta: { page: p, limit: l, offset },
  };
}

export function paginationMeta(total, { page, limit }) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  };
}
