# Spec: Analytics & Statistics

## Overview
Basic analytics dashboard for restaurant owners/managers. Aggregated from orders and bills data.

## Metrics
### Revenue
- Daily/weekly/monthly revenue totals
- Revenue trend chart (last 30 days)
- Comparison with previous period

### Orders
- Order volume by hour (heatmap data)
- Average order value
- Orders per table
- Peak hours identification

### Menu Performance
- Top 10 popular items (by quantity sold)
- Category-wise sales breakdown
- Item revenue ranking
- Items never/rarely ordered

### Operations
- Average table turnover time
- Average order preparation time
- Orders by status (completion rate)

## API Endpoints
- `GET /api/analytics/revenue?period=daily|weekly|monthly&from=&to=`
- `GET /api/analytics/orders?period=daily|weekly|monthly&from=&to=`
- `GET /api/analytics/popular-items?limit=10&from=&to=`
- `GET /api/analytics/category-sales?from=&to=`
- `GET /api/analytics/dashboard` — Summary of all key metrics for today

## Query Optimization
- Use PostgreSQL aggregate functions (SUM, COUNT, AVG, GROUP BY)
- Date-based indexes on orders.created_at and bills.created_at
- Cache dashboard endpoint in Redis (1 minute TTL)
- Avoid N+1: join orders + items in single query

## Acceptance Criteria
- [ ] Revenue shows accurate totals for all time periods
- [ ] Popular items ranking matches actual order data
- [ ] Dashboard loads in <500ms
- [ ] Date range filtering works correctly
- [ ] Category breakdown sums match total revenue
