/**
 * Lightweight checks (no running API): compiled helpers from the API dist folder.
 * Run after `cd apps/api && npm run build`.
 */
import { parseSortParam } from '../apps/api/dist/common/sort/parse-sort.js';
import { toPaginated } from '../apps/api/dist/common/pagination/paginated-result.js';

const s = parseSortParam(
  '-dueDate',
  { dueDate: 'ci.due_date', id: 'ci.id' },
  'id',
);
if (s.order !== 'DESC' || s.column !== 'ci.due_date') {
  throw new Error(`parseSortParam DESC: got ${JSON.stringify(s)}`);
}

const p = toPaginated([1, 2], 1, 2, 5);
if (!p.hasMore || p.total !== 5 || p.items.length !== 2) {
  throw new Error(`toPaginated: ${JSON.stringify(p)}`);
}

console.log('pagination-smoke: ok');
