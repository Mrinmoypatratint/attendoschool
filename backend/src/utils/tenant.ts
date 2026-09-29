/**
 * Multi-Tenant & Test-School Isolation Utilities
 *
 * Ensures that test seed data (demo students, classes, sections, teachers, subjects,
 * routines, timetable entries, and analytics) is strictly restricted to Greenwood
 * International School and Techno International New Town (TINT).
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

export const TINT_TEST_ALIASES = [
  'school-tint-001',
  'sch-tint-001',
  '00000000-0000-0000-0000-000000000002',
  'tint',
  'tint001',
  'tint-001',
  'techno-international-new-town',
  'techno international new town',
  'techno international new town (tint)',
  'tint - techno international new town'
];

export function isGreenwoodSchool(schoolId?: string | null, schoolCode?: string | null): boolean {
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

export function isTintSchool(schoolId?: string | null, schoolCode?: string | null): boolean {
  if (!schoolId && !schoolCode) return false;
  const sid = (schoolId || '').toLowerCase().trim();
  const scode = (schoolCode || '').toLowerCase().trim();
  return (
    TINT_TEST_ALIASES.includes(sid) ||
    TINT_TEST_ALIASES.includes(scode) ||
    sid.includes('tint') ||
    scode.includes('tint') ||
    sid.includes('techno')
  );
}

/**
 * Checks if a given school ID or code belongs to either demo school (Greenwood or TINT).
 */
export function isTestSchool(schoolId?: string | null, schoolCode?: string | null): boolean {
  return isGreenwoodSchool(schoolId, schoolCode) || isTintSchool(schoolId, schoolCode);
}

/**
 * Strict tenant equality helper.
 */
export function isSameSchool(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim();
  const cleanB = b.trim();
  if (cleanA === cleanB) return true;

  const lowA = cleanA.toLowerCase();
  const lowB = cleanB.toLowerCase();
  if (lowA === lowB) return true;

  if (isGreenwoodSchool(lowA) && isGreenwoodSchool(lowB)) return true;
  if (isTintSchool(lowA) && isTintSchool(lowB)) return true;

  return false;
}

/**
 * Standardizes school ID aliases to canonical UUIDs.
 */
export function canonicalSchoolId(id?: string | null): string | null {
  if (!id) return null;
  if (isGreenwoodSchool(id)) {
    return '00000000-0000-0000-0000-000000000001';
  }
  if (isTintSchool(id)) {
    return '00000000-0000-0000-0000-000000000002';
  }
  return id;
}
