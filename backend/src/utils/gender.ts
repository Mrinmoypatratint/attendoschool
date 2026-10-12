/**
 * Standardizes gender representations in backend services, APIs, and database transactions.
 * Maps 'F', 'M', 'female', 'male', 'f', 'm', 'boy', 'girl', etc. to canonical 'Male' | 'Female' | 'Other'.
 */
export function normalizeGender(val?: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s === '—' || s === '-' || s.toLowerCase() === 'not specified' || s.toLowerCase() === 'null') {
    return null;
  }

  // Female patterns: 'f', 'female', 'females', 'girl', 'fem', 'f.', 'females'
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

  // Broad prefix matches
  if (/^fem/i.test(s)) return 'Female';
  if (/^f/i.test(s)) return 'Female';
  if (/^m/i.test(s)) return 'Male';
  if (/^o/i.test(s)) return 'Other';

  return s;
}
