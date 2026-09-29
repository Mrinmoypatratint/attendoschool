import { useState, useCallback } from 'react';
import { PreviewChangeData } from './types';

/**
 * Utility to calculate differences between two objects for change detection in preview
 */
export function calculateChanges<T extends Record<string, any>>(
  original: T | null | undefined,
  updated: T | null | undefined,
  fieldLabels: Record<string, string>,
  formatters?: Record<string, (val: any) => string>
): PreviewChangeData[] {
  if (!original || !updated) return [];

  const changes: PreviewChangeData[] = [];

  for (const [key, label] of Object.entries(fieldLabels)) {
    const prev = original[key];
    const next = updated[key];

    // Check for meaningful difference
    const prevNorm = prev === undefined || prev === null ? '' : String(prev).trim();
    const nextNorm = next === undefined || next === null ? '' : String(next).trim();

    if (prevNorm !== nextNorm) {
      const format = formatters?.[key] || ((v: any) => (v === undefined || v === null || v === '' ? '—' : String(v)));
      changes.push({
        field: key,
        label,
        previousValue: format(prev),
        newValue: format(next),
        isChanged: true,
      });
    }
  }

  return changes;
}

export interface UsePreviewConfirmOptions {
  onConfirm: () => Promise<void> | void;
  onEdit?: () => void;
}

export function usePreviewConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPreview = useCallback(() => {
    setError(null);
    setIsOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    if (loading) return; // Prevent closing while API submission is in flight
    setIsOpen(false);
    setError(null);
  }, [loading]);

  const handleEdit = useCallback((onEditCallback?: () => void) => {
    setIsOpen(false);
    setError(null);
    if (onEditCallback) {
      onEditCallback();
    }
  }, []);

  const handleConfirm = useCallback(
    async (confirmAction: () => Promise<void> | void) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        await confirmAction();
        setIsOpen(false);
      } catch (err: any) {
        console.error('Preview confirmation error:', err);
        setError(err?.response?.data?.message || err?.message || 'Failed to complete operation. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  return {
    isOpen,
    loading,
    error,
    openPreview,
    closePreview,
    handleEdit,
    handleConfirm,
    setError,
  };
}
