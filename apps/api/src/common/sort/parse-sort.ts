export type SortOrder = 'ASC' | 'DESC';

/**
 * Parses `sort` query like `dueDate` or `-updatedAt`. Unknown keys fall back to default.
 * `allowed` maps API field name → query-builder column (e.g. `ci.due_date`).
 */
export function parseSortParam(
  sort: string | undefined,
  allowed: Record<string, string>,
  defaultKey: string,
): { column: string; order: SortOrder } {
  const fallback = allowed[defaultKey] ?? Object.values(allowed)[0];
  if (!sort?.trim()) {
    return { column: fallback, order: 'ASC' };
  }
  const trimmed = sort.trim();
  const desc = trimmed.startsWith('-');
  const key = desc ? trimmed.slice(1) : trimmed;
  if (!allowed[key]) {
    return { column: fallback, order: 'ASC' };
  }
  return { column: allowed[key], order: desc ? 'DESC' : 'ASC' };
}
