import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState, ErrorState, SkeletonRows } from "./Feedback";
import { useI18n } from "../../context/PreferencesContext";

/**
 * Accessible table. Columns: { key, header, render?(row), sortable?, sortValue?(row), align?: "right", width? }.
 * - Client sorting when `onSort` is not provided.
 * - Server sorting: pass `sort` ({ key, desc }) and `onSort(key)`.
 * Turns into stacked cards on small screens.
 */
export default function DataTable({
  columns, rows, loading, error, onRetry, rowKey = "id", onRowClick, emptyTitle, emptyMessage, emptyIcon,
  sort: controlledSort, onSort, caption,
}) {
  const { t } = useI18n();
  const [localSort, setLocalSort] = useState(null);
  const sort = controlledSort ?? localSort;

  const sorted = useMemo(() => {
    if (!rows || onSort || !localSort) return rows || [];
    const col = columns.find((c) => c.key === localSort.key);
    if (!col) return rows;
    const get = col.sortValue || ((r) => r[col.key]);
    return [...rows].sort((a, b) => {
      const x = get(a); const y = get(b);
      const res = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""));
      return localSort.desc ? -res : res;
    });
  }, [rows, columns, localSort, onSort]);

  const toggle = (key) => {
    if (onSort) return onSort(key);
    setLocalSort((s) => (s?.key === key ? { key, desc: !s.desc } : { key, desc: false }));
  };

  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !rows?.length) return <SkeletonRows cols={Math.min(columns.length, 5)} />;
  if (!sorted.length) return <EmptyState icon={emptyIcon} title={emptyTitle || t("common.noData")} message={emptyMessage} />;

  return (
    <div className="table-wrap" aria-busy={loading || undefined} style={{ opacity: loading ? 0.6 : 1, transition: "opacity 150ms" }}>
      <table className="table table--responsive">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort.desc ? "descending" : "ascending") : undefined;
              return (
                <th key={c.key} scope="col" className={c.align === "right" ? "num" : ""} style={{ width: c.width }} aria-sort={ariaSort}>
                  {c.sortable ? (
                    <button type="button" className="th-sort" onClick={() => toggle(c.key)}>
                      {c.header}
                      {active ? (sort.desc ? <ArrowDown size={14} /> : <ArrowUp size={14} />) : <ArrowUpDown size={14} opacity={0.4} />}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={typeof rowKey === "function" ? rowKey(row) : row[rowKey]}
              className={onRowClick ? "is-clickable" : ""}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} data-label={typeof c.header === "string" ? c.header : ""} className={c.align === "right" ? "num" : ""}>
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const { t, formatNumber } = useI18n();
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="text-sm text-muted">
        {t("common.showing", { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}
      </span>
      <div className="row">
        <button className="btn btn--outline btn--sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={16} aria-hidden /> {t("common.prev")}
        </button>
        <span className="text-sm">{t("common.page", { page: formatNumber(page), pages: formatNumber(pages) })}</span>
        <button className="btn btn--outline btn--sm" onClick={() => onChange(page + 1)} disabled={page >= pages}>
          {t("common.next")} <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
