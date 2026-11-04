import React, { useLayoutEffect, useEffect, useRef } from 'react';

export interface AutoExpandingTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  minHeight?: number;
  maxHeight?: number;
}

export const AutoExpandingTextarea: React.FC<AutoExpandingTextareaProps> = ({
  value,
  minHeight = 40,
  maxHeight = 180,
  style,
  onChange,
  onInput,
  className = '',
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset height to calculate true scrollHeight without previous expansion
    el.style.height = 'auto';

    // Account for borders (typically 2px for a 1px top + bottom border)
    const borderOffset = el.offsetHeight > el.clientHeight ? el.offsetHeight - el.clientHeight : 2;
    const computedH = Math.min(Math.max(el.scrollHeight + borderOffset, minHeight), maxHeight);

    el.style.height = `${computedH}px`;
    el.style.overflowY = el.scrollHeight + borderOffset > maxHeight ? 'auto' : 'hidden';
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value, minHeight, maxHeight]);

  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [minHeight, maxHeight]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onInput={(e) => {
        adjustHeight();
        onInput?.(e);
      }}
      rows={1}
      className={`w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${className}`}
      style={{
        ...style,
        resize: 'none',
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        boxSizing: 'border-box'
      }}
      {...props}
    />
  );
};

export default AutoExpandingTextarea;
