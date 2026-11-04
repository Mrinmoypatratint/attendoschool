import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { formatLastFetched } from '../utils/formatters';

export interface TableSubToolbarProps {
  onRefresh?: () => void;
  loading?: boolean;
  loadProgress?: number;
  lastFetchedAt?: Date | null;
  pageSize: number;
  onPageSizeChange: (newPageSize: number) => void;
  totalCount: number;
  filteredCount: number;
  startIdx: number;
  endIdx: number;
  itemLabel?: string;
  pageSizeOptions?: number[];
  children?: React.ReactNode;
}

export function TableSubToolbar({
  onRefresh,
  loading = false,
  loadProgress,
  lastFetchedAt = null,
  pageSize,
  onPageSizeChange,
  totalCount,
  filteredCount,
  startIdx,
  endIdx,
  itemLabel = 'students',
  pageSizeOptions = [10, 25, 50, 100, 250, 500],
  children
}: TableSubToolbarProps) {
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex-wrap gap-2.5">
      <div className="flex items-center gap-2.5 flex-wrap text-[13px] text-slate-600 dark:text-slate-400">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 cursor-pointer disabled:cursor-not-allowed font-semibold text-[12.5px] hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
            title={`Refresh ${itemLabel}`}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        )}
        {onRefresh && <span>•</span>}
        <span className="inline-flex items-center gap-1">
          Last fetched: <b className="text-slate-900 dark:text-slate-100">{formatLastFetched(lastFetchedAt)}</b>
        </span>
        {loading && (
          <span className="inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
            <Loader2 size={10} className="animate-spin" />
            {loadProgress !== undefined ? `${loadProgress}%` : 'Loading...'}
          </span>
        )}
        {children}
      </div>

      <div className="flex items-center gap-3.5 flex-wrap">
        <div className="flex items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-400">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="directory-select px-2 py-1 text-[12.5px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {pageSizeOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt === 25 ? '25 (Default)' : opt}
              </option>
            ))}
            <option value={100000}>All ({filteredCount})</option>
          </select>
        </div>
        <div className="text-[13px] text-slate-500 dark:text-slate-400">
          {filteredCount === 0 ? (
            `Showing 0 ${itemLabel}`
          ) : (
            <>
              Showing <b className="text-slate-900 dark:text-slate-100">{startIdx + 1}</b> to{' '}
              <b className="text-slate-900 dark:text-slate-100">{endIdx}</b> of{' '}
              <b className="text-slate-900 dark:text-slate-100">{filteredCount}</b> {itemLabel}
              {filteredCount !== totalCount && (
                <span className="opacity-75 ml-1">(filtered from {totalCount} total)</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export interface TablePaginationFooterProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  startIdx: number;
  endIdx: number;
  filteredCount: number;
  totalCount: number;
  itemLabel?: string;
  onScrollToTop?: () => void;
}

export function TablePaginationFooter({
  currentPage,
  totalPages,
  onPageChange,
  startIdx,
  endIdx,
  filteredCount,
  totalCount,
  itemLabel = 'students',
  onScrollToTop
}: TablePaginationFooterProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  const goTo = (p: number) => {
    onPageChange(p);
    if (onScrollToTop) onScrollToTop();
  };

  return (
    <div className="directory-box-footer flex justify-between items-center px-4.5 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex-wrap gap-3">
      <div className="text-slate-600 dark:text-slate-400 text-[12.5px]">
        {filteredCount === 0 ? (
          `Showing 0 ${itemLabel}`
        ) : (
          <>
            Showing <b className="text-slate-900 dark:text-slate-100">{startIdx + 1}</b> to{' '}
            <b className="text-slate-900 dark:text-slate-100">{endIdx}</b> of{' '}
            <b className="text-slate-900 dark:text-slate-100">{filteredCount}</b> {itemLabel}
            {filteredCount !== totalCount && (
              <span className="opacity-75 ml-1">(filtered from {totalCount} total)</span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          className="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          disabled={safeCurrentPage <= 1}
          onClick={() => goTo(1)}
          title="First Page"
        >
          <ChevronsLeft size={14} /> First
        </button>
        <button
          type="button"
          className="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          disabled={safeCurrentPage <= 1}
          onClick={() => goTo(safeCurrentPage - 1)}
          title="Previous Page"
        >
          <ChevronLeft size={14} /> Previous
        </button>

        <div className="flex items-center gap-1 mx-1 text-[12.5px] text-slate-600 dark:text-slate-400">
          <span>Page</span>
          <select
            value={safeCurrentPage}
            onChange={(e) => goTo(Number(e.target.value))}
            className="directory-select px-1.5 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Array.from({ length: safeTotalPages }, (_, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {idx + 1}
              </option>
            ))}
          </select>
          <span>
            of <b className="text-slate-900 dark:text-slate-100">{safeTotalPages}</b>
          </span>
        </div>

        <button
          type="button"
          className="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          disabled={safeCurrentPage >= safeTotalPages}
          onClick={() => goTo(safeCurrentPage + 1)}
          title="Next Page"
        >
          Next <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          disabled={safeCurrentPage >= safeTotalPages}
          onClick={() => goTo(safeTotalPages)}
          title="Last Page"
        >
          Last <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
