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
  'sch-1790665531365',
  'tint',
  'tint001',
  'tint-001',
  'tint-187',
  'techno-international-new-town',
  'techno international new town',
  'techno international new town (tint)',
  'tint - techno international new town',
  'tint school'
];

export const DAV_TEST_ALIASES = [
  '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3',
  '15582',
  'dav',
  'dav model school',
  'dav-model-school'
];

export function isDavSchool(schoolId?: string | null, schoolCode?: string | null): boolean {
  if (!schoolId && !schoolCode) return false;
  const sid = (schoolId || '').toLowerCase().trim();
  const scode = (schoolCode || '').toLowerCase().trim();
  return (
    DAV_TEST_ALIASES.includes(sid) ||
    DAV_TEST_ALIASES.includes(scode) ||
    sid.includes('dav') ||
    scode.includes('15582')
  );
}

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
    scode.includes('tint')
  );
}

/**
 * Checks if a given school ID or code belongs to demo schools (Greenwood, TINT, DAV).
 */
export function isTestSchool(schoolId?: string | null, schoolCode?: string | null): boolean {
  return isGreenwoodSchool(schoolId, schoolCode) || isTintSchool(schoolId, schoolCode) || isDavSchool(schoolId, schoolCode);
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
  if (isDavSchool(lowA) && isDavSchool(lowB)) return true;

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
    return 'sch-1790665531365';
  }
  if (isDavSchool(id)) {
    return '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3';
  }
  return id;
}
