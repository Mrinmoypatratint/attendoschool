import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, MoreVertical } from 'lucide-react';

interface NavVisibilityMenuProps {
  hidden: boolean;
  onToggle: () => void;
  label?: string;
}

export function NavVisibilityMenu({ hidden, onToggle, label = 'navigation sidebar' }: NavVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`nav-visibility-menu ${hidden ? 'nav-is-hidden' : ''}`}>
      <button
        type="button"
        className="nav-visibility-dots"
        onClick={() => setOpen(value => !value)}
        aria-label="Navigation options"
        aria-expanded={open}
        title="Navigation options"
      >
        <MoreVertical size={19} />
      </button>
      {open && (
        <div className="nav-visibility-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggle();
              setOpen(false);
            }}
          >
            {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
            <span>{hidden ? `Show ${label}` : `Hide ${label}`}</span>
          </button>
        </div>
      )}
    </div>
  );
}

