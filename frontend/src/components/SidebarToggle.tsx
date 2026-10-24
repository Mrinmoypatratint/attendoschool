import React from 'react';
import { MoreVertical } from 'lucide-react';

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  iconSize?: number;
}

/** Shared, single-action navigation control used by every authenticated shell. */
export function SidebarToggle({ collapsed, onToggle, className = '', iconSize = 18 }: SidebarToggleProps) {
  const action = collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar';
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={action}
      aria-expanded={!collapsed}
      aria-controls="primary-navigation"
      title={action}
    >
      <MoreVertical size={iconSize} aria-hidden="true" />
    </button>
  );
}
