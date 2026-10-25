/**
 * Roman Numeral to Digital Number Conversion Utility for Classes
 * Converts Roman numeral school classes (I to XII) to digital numbers (1 to 12).
 * e.g. "Class IV-B" -> "Class 4-B"
 *      "Class VI-I" -> "Class 6-I"
 *      "Class V-E"  -> "Class 5-E"
 *      "Class III-A" -> "Class 3-A"
 *      "IV"         -> "Class 4"
 */

export const ROMAN_TO_DIGIT_MAP: Record<string, number> = {
  xii: 12,
  xi: 11,
  x: 10,
  ix: 9,
  viii: 8,
  vii: 7,
  vi: 6,
  v: 5,
  iv: 4,
  iii: 3,
  ii: 2,
  i: 1,
};

/**
 * Converts any class representation containing Roman numerals (e.g. "Class IV-B", "IV-B", "Class VI-I")
 * to a standardized digital number class string (e.g. "Class 4-B", "Class 6-I").
 */
export function convertRomanClassToDigital(val: any): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s || s === '—') return s;

  // Split multiple comma-separated allocations if present
  return s
    .split(',')
    .map((item) => {
      const trimmed = item.trim();
      if (!trimmed) return '';

      // Preserve special kindergarten values
      if (/^class\s*l\s*kg/i.test(trimmed) || /^-1/i.test(trimmed)) {
        return trimmed.replace(/^-1/, 'Class L KG');
      }
      if (/^class\s*u\s*kg/i.test(trimmed) || /^0/i.test(trimmed)) {
        return trimmed.replace(/^0/, 'Class U KG');
      }

      // Match Roman numerals with optional prefix "Class", "Grade", "Std" and optional section suffix
      // e.g. "Class IV-B", "Class IV - B", "Class IV", "IV-B", "IV", "Class VI-I"
      const match = trimmed.match(
        /^((?:Class|Grade|Std|Standard)\s*[:.-]?\s*)?(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)([\s\-_/].*|$)/i
      );
      if (match) {
        const prefix = match[1] || 'Class ';
        const romanKey = match[2].toLowerCase();
        const num = ROMAN_TO_DIGIT_MAP[romanKey];
        const rest = match[3] || '';
        if (num !== undefined) {
          const cleanRest = rest.replace(/\s*-\s*/, '-').replace(/^\s+/, ' ');
          return `${prefix.trim()} ${num}${cleanRest ? (cleanRest.startsWith('-') ? cleanRest : `${cleanRest}`) : ''}`.trim();
        }
      }

      // If it's already a digital number like "Class 4-B" or "4-B"
      const digitMatch = trimmed.match(
        /^((?:Class|Grade|Std|Standard)\s*[:.-]?\s*)?(\d+)([\s\-_/].*|$)/i
      );
      if (digitMatch) {
        const prefix = digitMatch[1] || 'Class ';
        const num = digitMatch[2];
        const rest = digitMatch[3] || '';
        const cleanRest = rest.replace(/\s*-\s*/, '-').replace(/^\s+/, ' ');
        return `${prefix.trim()} ${num}${cleanRest ? (cleanRest.startsWith('-') ? cleanRest : `${cleanRest}`) : ''}`.trim();
      }

      return trimmed;
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Parses raw class and section inputs from Excel, converting Roman numerals to digital numbers.
 */
export function parseImportClassAndSection(
  rawClassInput: string,
  rawSectionInput: string
): { className: string; sectionName: string } {
  let cls = String(rawClassInput || '').trim();
  let sec = String(rawSectionInput || '').trim().toUpperCase();

  // If section was not specified or empty, but class string contains a section (e.g. "Class IV-B", "IV-B", "Class 4-B")
  if (!sec || sec === 'A') {
    const embedMatch = cls.match(/^(.+?)[\s\-_/]+([A-Za-z])$/);
    if (embedMatch) {
      cls = embedMatch[1].trim();
      sec = embedMatch[2].toUpperCase();
    }
  }

  // Convert Roman numerals in class
  const romanMatch = cls.match(
    /^((?:Class|Grade|Std|Standard)\s*[:.-]?\s*)?(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)$/i
  );
  if (romanMatch) {
    const roman = romanMatch[2].toLowerCase();
    const digit = ROMAN_TO_DIGIT_MAP[roman];
    if (digit !== undefined) {
      cls = `Class ${digit}`;
    }
  } else if (/^\d+$/.test(cls)) {
    cls = `Class ${cls}`;
  } else if (/^(?:Class|Grade|Std|Standard)\s*[:.-]?\s*(\d+)$/i.test(cls)) {
    const num = cls.match(/(\d+)$/)?.[1];
    if (num) cls = `Class ${num}`;
  } else if (/^l\s*kg$/i.test(cls)) {
    cls = 'Class L KG';
  } else if (/^u\s*kg$/i.test(cls)) {
    cls = 'Class U KG';
  }

  return { className: cls, sectionName: sec || 'A' };
}
