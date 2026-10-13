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
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 16px',
      borderBottom: '1px solid var(--border, #e2e8f0)',
      background: 'var(--card-subtle, #f8fafc)',
      flexWrap: 'wrap',
      gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary, #475569)' }}>
        {onRefresh && (
          <button 
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 'none',
              padding: '2px 6px',
              borderRadius: 4,
              color: '#2563eb',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 12.5
            }}
            title={`Refresh ${itemLabel}`}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spinAnim 0.8s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
        )}
        {onRefresh && <span>•</span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Last fetched: <b>{formatLastFetched(lastFetchedAt)}</b>
        </span>
        {loading && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 3,
            padding: '1px 5px',
            borderRadius: 4,
            background: '#dbeafe',
            color: '#1d4ed8',
            fontWeight: 600,
            fontSize: 11
          }}>
            <Loader2 size={10} style={{ animation: 'spinAnim 0.8s linear infinite' }} />
            {loadProgress !== undefined ? `${loadProgress}%` : 'Loading...'}
          </span>
        )}
        {children}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #475569)' }}>
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              fontSize: 12.5,
              borderRadius: 6,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text, #1e293b)',
              cursor: 'pointer'
            }}
          >
            {pageSizeOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt === 25 ? '25 (Default)' : opt}
              </option>
            ))}
            <option value={100000}>All ({filteredCount})</option>
          </select>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {filteredCount === 0 ? (
            `Showing 0 ${itemLabel}`
          ) : (
            <>
              Showing <b>{startIdx + 1}</b> to <b>{endIdx}</b> of <b>{filteredCount}</b> {itemLabel}
              {filteredCount !== totalCount && (
                <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {totalCount} total)</span>
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
    <div className="directory-box-footer" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '11px 18px',
      borderTop: '1px solid var(--border, #e2e8f0)',
      background: 'var(--card-subtle, #f8fafc)',
      flexWrap: 'wrap',
      gap: 12
    }}>
      <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5 }}>
        {filteredCount === 0 ? (
          `Showing 0 ${itemLabel}`
        ) : (
          <>
            Showing <b>{startIdx + 1}</b> to <b>{endIdx}</b> of <b>{filteredCount}</b> {itemLabel}
            {filteredCount !== totalCount && (
              <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {totalCount} total)</span>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
          disabled={safeCurrentPage <= 1}
          onClick={() => goTo(1)}
          title="First Page"
        >
          <ChevronsLeft size={14} /> First
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
          disabled={safeCurrentPage <= 1}
          onClick={() => goTo(safeCurrentPage - 1)}
          title="Previous Page"
        >
          <ChevronLeft size={14} /> Previous
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 12.5 }}>
          <span>Page</span>
          <select
            value={safeCurrentPage}
            onChange={(e) => goTo(Number(e.target.value))}
            style={{
              padding: '3px 6px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text, #1e293b)',
              cursor: 'pointer'
            }}
          >
            {Array.from({ length: safeTotalPages }, (_, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {idx + 1}
              </option>
            ))}
          </select>
          <span>of <b>{safeTotalPages}</b></span>
        </div>

        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
          disabled={safeCurrentPage >= safeTotalPages}
          onClick={() => goTo(safeCurrentPage + 1)}
          title="Next Page"
        >
          Next <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
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
