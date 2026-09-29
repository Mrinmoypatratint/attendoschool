import React from 'react';

export type PreviewFieldType =
  | 'text'
  | 'badge'
  | 'status'
  | 'boolean'
  | 'date'
  | 'email'
  | 'phone'
  | 'code'
  | 'currency'
  | 'pill';

export interface PreviewFieldData {
  label: string;
  value: any;
  type?: PreviewFieldType;
  color?: 'green' | 'blue' | 'red' | 'amber' | 'purple' | 'slate';
  icon?: React.ReactNode;
  span?: 1 | 2; // grid column span
}

export interface PreviewSectionData {
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: 'green' | 'blue' | 'amber' | 'purple';
  fields: PreviewFieldData[];
}

export interface PreviewChangeData {
  field: string;
  label: string;
  previousValue: any;
  newValue: any;
  isChanged?: boolean;
}

export interface PreviewSummaryCard {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'blue' | 'red' | 'amber' | 'purple';
  icon?: React.ReactNode;
}

export interface PreviewTableData {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
}

export interface UniversalPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  subtitle?: string;
  entityName?: string;
  operationType?: 'create' | 'update' | 'submit' | 'import' | 'delete' | 'action';
  confirmText?: string;
  editText?: string;
  loading?: boolean;
  error?: string | null;
  sections?: PreviewSectionData[];
  changes?: PreviewChangeData[];
  summaryCards?: PreviewSummaryCard[];
  tableData?: PreviewTableData;
  isDestructive?: boolean;
  destructiveWarning?: string;
  children?: React.ReactNode;
  width?: string | number;
}

export interface DestructiveConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  entityName: string;
  entityType: string;
  details?: { label: string; value: string | number }[];
  warningMessage?: string;
  confirmText?: string;
  loading?: boolean;
  error?: string | null;
}
