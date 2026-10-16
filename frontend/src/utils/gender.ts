/**
 * Standardizes gender representations across the application.
 * Ensures abbreviations ('M', 'F', 'm', 'f', 'mf', 'gen') or raw Excel entries
 * always render and save as full canonical words: 'Male', 'Female', or 'Other'.
 */
export function formatGender(val?: string | null): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s || s === '—' || s === '-' || s.toLowerCase() === 'not specified' || s.toLowerCase() === 'null') {
    return '';
  }

  // Female patterns: 'f', 'female', 'girl', 'fem', 'f.', 'females'
  if (/^(f|female|females|girl|fem)$/i.test(s) || /^f[\s\/\-_]/i.test(s) || s.toLowerCase() === 'f') {
    return 'Female';
  }

  // Male patterns: 'm', 'male', 'males', 'boy', 'm.', 'boy'
  if (/^(m|male|males|boy)$/i.test(s) || /^m[\s\/\-_]/i.test(s) || s.toLowerCase() === 'm') {
    return 'Male';
  }

  // Other patterns: 'o', 'other', 'non-binary', 'nb', 'transgender'
  if (/^(o|other|non-binary|nb|transgender)$/i.test(s)) {
    return 'Other';
  }

  // Broad prefixes
  if (/^fem/i.test(s)) return 'Female';
  if (/^f/i.test(s)) return 'Female';
  if (/^m/i.test(s)) return 'Male';
  if (/^o/i.test(s)) return 'Other';

  return s;
}

export function normalizeGender(val?: string | null): string {
  return formatGender(val);
}
