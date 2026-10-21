"use client";

import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /** On mobile card view, stack label above content full-width instead of side-by-side */
  mobileStack?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  pageSize?: number;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  emptyMessage = "No data available.",
  onRowClick,
  searchable = false,
  pageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0 && !search) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <p className="text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search..."
            className="w-full rounded-xl border border-line bg-subtle/50 py-2.5 pl-10 pr-4 text-sm text-on-page placeholder:text-muted transition-colors focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>
      )}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-subtle">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row) => (
              <tr
                key={String(row[keyField])}
                className={cn(
                  "border-b border-line-subtle transition-colors hover:bg-on-page/[0.02]",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3.5", col.className)}
                  >
                    {col.render
                      ? col.render(row)
                      : (String(row[col.key] ?? "") as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {paginated.map((row) => (
          <div
            key={String(row[keyField])}
            className={cn(
              "rounded-xl border border-line bg-surface p-4 shadow-sm",
              onRowClick && "cursor-pointer active:bg-subtle/50"
            )}
            onClick={() => onRowClick?.(row)}
          >
            {columns.map((col, idx) => (
              <div
                key={col.key}
                className={cn(
                  "py-2.5",
                  idx < columns.length - 1 && "border-b border-line-subtle",
                  col.mobileStack
                    ? "flex flex-col gap-1.5"
                    : "flex flex-wrap items-center justify-between gap-x-2"
                )}
              >
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {col.header}
                </span>
                <span className={cn("min-w-0 flex-1 text-sm text-on-surface", col.mobileStack && "overflow-auto")}>
                  {col.render
                    ? col.render(row)
                    : (String(row[col.key] ?? "") || "—") as React.ReactNode}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {filtered.length === 0 && search && (
        <div className="py-8 text-center text-sm text-muted">
          No results for &ldquo;{search}&rdquo;
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-xs text-muted">
          <span>
            {filtered.length} result{filtered.length !== 1 && "s"}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
