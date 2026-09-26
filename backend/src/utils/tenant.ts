/**
 * Multi-Tenant & Test-School Isolation Utilities
 *
 * Ensures that test seed data (demo students, classes, sections, teachers, subjects,
 * routines, timetable entries, and analytics) is strictly restricted to Greenwood
 * International School (the test sandbox school).
 *
 * All other schools, especially newly registered or created institutions, start 100% clean
 * with zero pre-populated data until manually entered by their administrators.
 */

export const GREENWOOD_TEST_ALIASES = [
  'school-greenwood-001',
  'sch-greenwood-001',
  '00000000-0000-0000-0000-000000000001',
  'greenwood',
  'greenwood-international',
  'greenwood-international-school',
  'greenwood-high',
  'gis001',
  'gis-001',
  'gwis-2025'
];

/**
 * Checks if a given school ID or code belongs to the Greenwood test school.
 * Returns true for all Greenwood test aliases and identifiers.
 */
export function isTestSchool(schoolId?: string | null, schoolCode?: string | null): boolean {
  if (!schoolId && !schoolCode) return false;
  const sid = (schoolId || '').toLowerCase().trim();
  const scode = (schoolCode || '').toLowerCase().trim();
  return (
    GREENWOOD_TEST_ALIASES.includes(sid) ||
    GREENWOOD_TEST_ALIASES.includes(scode) ||
    sid.includes('greenwood') ||
    scode.includes('gis001')
  );
}

/**
 * Strict tenant equality helper.
 * Does NOT return true if either identifier is missing/null/undefined.
 */
export function isSameSchool(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim();
  const cleanB = b.trim();
  if (cleanA === cleanB) return true;

  const lowA = cleanA.toLowerCase();
  const lowB = cleanB.toLowerCase();
  if (lowA === lowB) return true;

  return isTestSchool(lowA) && isTestSchool(lowB);
}

/**
 * Standardizes Greenwood school ID aliases to the canonical UUID.
 * Leaves all other school IDs unchanged.
 */
export function canonicalSchoolId(id?: string | null): string | null {
  if (!id) return null;
  if (isTestSchool(id)) {
    return '00000000-0000-0000-0000-000000000001';
  }
  return id;
}
