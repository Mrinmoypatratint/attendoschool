import { pool, isPostgresConfigured } from '../db';

export interface SchoolWorkingDaysConfig {
  school_id: string;
  working_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  weekend_days: number[]; // 0=Sun, ..., 6=Sat
  saturday_rule: 'WORKING' | 'HALF_DAY' | 'OFF';
  updated_at?: string;
}

export interface SchoolHoliday {
  id: string;
  school_id: string;
  name: string;
  holiday_date: string; // YYYY-MM-DD
  holiday_type: 'GAZETTED' | 'NATIONAL' | 'REGIONAL' | 'INSTITUTIONAL' | 'FESTIVAL';
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarDayBreakdown {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sun..6=Sat
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isWeekendAndHoliday: boolean;
  isHalfDay: boolean;
  holidayName: string | null;
  holidayType: string | null;
  status: 'WORKING_DAY' | 'HALF_DAY' | 'WEEKEND' | 'HOLIDAY' | 'WEEKEND_AND_HOLIDAY';
  workingWeight: number; // 1, 0.5, or 0
}

export interface CalendarCalculationResult {
  schoolId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  workingDays: number;
  nonWorkingDays: number;
  weekendDays: number;
  holidayDays: number;
  overlapDays: number;
  halfDays: number;
  saturdayRule: 'WORKING' | 'HALF_DAY' | 'OFF';
  breakdown: CalendarDayBreakdown[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// In-memory tenant store for fallback / testing when Postgres is not available
const memWorkingDays: Record<string, SchoolWorkingDaysConfig> = {};
const memHolidays: Record<string, SchoolHoliday[]> = {};

/**
 * Ensure database tables exist
 */
let tablesInitialized = false;
export async function ensureCalendarTables(): Promise<void> {
  if (tablesInitialized || !isPostgresConfigured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_working_days (
        school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
        working_days SMALLINT[] DEFAULT ARRAY[1,2,3,4,5,6],
        weekend_days SMALLINT[] DEFAULT ARRAY[0],
        saturday_rule VARCHAR(20) DEFAULT 'WORKING',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        holiday_date DATE NOT NULL,
        holiday_type VARCHAR(50) DEFAULT 'GAZETTED',
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_school_holiday_date UNIQUE (school_id, holiday_date)
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_school_holidays_date ON school_holidays(school_id, holiday_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_school_holidays_active ON school_holidays(school_id, is_active);`);
    tablesInitialized = true;
  } catch (err: any) {
    console.error('[CalendarService] Failed to ensure calendar tables:', err.message);
    tablesInitialized = true;
  }
}

// Auto-run schema check
ensureCalendarTables().catch(() => {});

/**
 * Format date strictly as YYYY-MM-DD
 */
export function formatDateYMD(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string into UTC Date object safely, without local timezone shift
 */
export function parseYMDToUtc(str: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new Error(`Invalid date format '${str}'. Expected YYYY-MM-DD.`);
  }
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Validate leap year and month boundaries (e.g. Feb 31, Apr 31 should fail)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Invalid calendar date '${str}'.`);
  }
  return date;
}

/**
 * Get school working days configuration (defaults to Mon-Sat working, Sun off)
 */
export async function getSchoolWorkingDays(schoolId: string): Promise<SchoolWorkingDaysConfig> {
  await ensureCalendarTables();

  const defaultConfig: SchoolWorkingDaysConfig = {
    school_id: schoolId,
    working_days: [1, 2, 3, 4, 5, 6], // Mon-Sat
    weekend_days: [0],                 // Sun
    saturday_rule: 'WORKING',
    updated_at: new Date().toISOString()
  };

  const isSchoolUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(schoolId));
  if (!isPostgresConfigured || !isSchoolUuid) {
    return memWorkingDays[schoolId] || defaultConfig;
  }

  try {
    const res = await pool.query(
      `SELECT school_id, working_days, weekend_days, saturday_rule, updated_at
       FROM school_working_days
       WHERE school_id = $1`,
      [schoolId]
    );

    if (res.rowCount && res.rows[0]) {
      const row = res.rows[0];
      return {
        school_id: row.school_id,
        working_days: (row.working_days || [1, 2, 3, 4, 5, 6]).map(Number),
        weekend_days: (row.weekend_days || [0]).map(Number),
        saturday_rule: row.saturday_rule || 'WORKING',
        updated_at: row.updated_at
      };
    }

    // Check if school exists in schools table before inserting default record to satisfy FK
    const schoolExists = await pool.query('SELECT id FROM schools WHERE id = $1 LIMIT 1', [schoolId]);
    if (!schoolExists.rowCount) {
      memWorkingDays[schoolId] = defaultConfig;
      return defaultConfig;
    }

    // Insert default record if not exists
    await pool.query(
      `INSERT INTO school_working_days (school_id, working_days, weekend_days, saturday_rule)
       VALUES ($1, ARRAY[1,2,3,4,5,6], ARRAY[0], 'WORKING')
       ON CONFLICT (school_id) DO NOTHING`,
      [schoolId]
    );

    return defaultConfig;
  } catch (err: any) {
    console.error('[CalendarService] Error fetching working days config:', err.message);
    return memWorkingDays[schoolId] || defaultConfig;
  }
}

/**
 * Update school working days and weekend configuration
 */
export async function updateSchoolWorkingDays(
  schoolId: string,
  config: {
    working_days?: number[];
    weekend_days?: number[];
    saturday_rule?: 'WORKING' | 'HALF_DAY' | 'OFF';
  }
): Promise<SchoolWorkingDaysConfig> {
  await ensureCalendarTables();

  const workingDays = config.working_days || [1, 2, 3, 4, 5, 6];
  const weekendDays = config.weekend_days || [0];
  const saturdayRule = config.saturday_rule || 'WORKING';

  // In-memory update for fallback
  memWorkingDays[schoolId] = {
    school_id: schoolId,
    working_days: workingDays,
    weekend_days: weekendDays,
    saturday_rule: saturdayRule,
    updated_at: new Date().toISOString()
  };

  if (!isPostgresConfigured) {
    return memWorkingDays[schoolId];
  }

  const res = await pool.query(
    `INSERT INTO school_working_days (school_id, working_days, weekend_days, saturday_rule, updated_at)
     VALUES ($1, $2::smallint[], $3::smallint[], $4, NOW())
     ON CONFLICT (school_id) DO UPDATE
     SET working_days = EXCLUDED.working_days,
         weekend_days = EXCLUDED.weekend_days,
         saturday_rule = EXCLUDED.saturday_rule,
         updated_at = NOW()
     RETURNING school_id, working_days, weekend_days, saturday_rule, updated_at`,
    [schoolId, workingDays, weekendDays, saturdayRule]
  );

  const row = res.rows[0];
  return {
    school_id: row.school_id,
    working_days: (row.working_days || []).map(Number),
    weekend_days: (row.weekend_days || []).map(Number),
    saturday_rule: row.saturday_rule,
    updated_at: row.updated_at
  };
}

/**
 * List school holidays with optional date-range or active filter
 */
export async function listSchoolHolidays(
  schoolId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    includeInactive?: boolean;
    holidayType?: string;
  }
): Promise<SchoolHoliday[]> {
  await ensureCalendarTables();

  if (!isPostgresConfigured) {
    let list = memHolidays[schoolId] || [];
    if (!options?.includeInactive) {
      list = list.filter(h => h.is_active);
    }
    if (options?.startDate) {
      list = list.filter(h => h.holiday_date >= options.startDate!);
    }
    if (options?.endDate) {
      list = list.filter(h => h.holiday_date <= options.endDate!);
    }
    if (options?.holidayType) {
      list = list.filter(h => h.holiday_type === options.holidayType);
    }
    return list.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  }

  try {
    let query = `
      SELECT id, school_id, name, to_char(holiday_date, 'YYYY-MM-DD') as holiday_date,
             holiday_type, description, is_active, created_at, updated_at
      FROM school_holidays
      WHERE school_id = $1
    `;
    const params: any[] = [schoolId];

    if (!options?.includeInactive) {
      params.push(true);
      query += ` AND is_active = $${params.length}`;
    }

    if (options?.startDate) {
      params.push(options.startDate);
      query += ` AND holiday_date >= $${params.length}::date`;
    }

    if (options?.endDate) {
      params.push(options.endDate);
      query += ` AND holiday_date <= $${params.length}::date`;
    }

    if (options?.holidayType) {
      params.push(options.holidayType);
      query += ` AND holiday_type = $${params.length}`;
    }

    query += ` ORDER BY holiday_date ASC`;

    const res = await pool.query(query, params);
    return res.rows;
  } catch (err: any) {
    console.error('[CalendarService] Error listing holidays:', err.message);
    return [];
  }
}

/**
 * Add or upsert a school holiday
 */
export async function addSchoolHoliday(
  schoolId: string,
  data: {
    name: string;
    holiday_date: string; // YYYY-MM-DD
    holiday_type?: 'GAZETTED' | 'NATIONAL' | 'REGIONAL' | 'INSTITUTIONAL' | 'FESTIVAL';
    description?: string;
  }
): Promise<SchoolHoliday> {
  await ensureCalendarTables();

  const cleanDate = data.holiday_date.trim();
  parseYMDToUtc(cleanDate); // validates date syntax and validity

  const holidayType = data.holiday_type || 'GAZETTED';
  const name = data.name.trim();

  if (!isPostgresConfigured) {
    const list = memHolidays[schoolId] || [];
    const existingIdx = list.findIndex(h => h.holiday_date === cleanDate);
    const item: SchoolHoliday = {
      id: existingIdx >= 0 ? list[existingIdx].id : `hol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      school_id: schoolId,
      name,
      holiday_date: cleanDate,
      holiday_type: holidayType,
      description: data.description || '',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      list[existingIdx] = item;
    } else {
      list.push(item);
    }
    memHolidays[schoolId] = list;
    return item;
  }

  const res = await pool.query(
    `INSERT INTO school_holidays (school_id, name, holiday_date, holiday_type, description, is_active, updated_at)
     VALUES ($1, $2, $3::date, $4, $5, TRUE, NOW())
     ON CONFLICT (school_id, holiday_date) DO UPDATE
     SET name = EXCLUDED.name,
         holiday_type = EXCLUDED.holiday_type,
         description = EXCLUDED.description,
         is_active = TRUE,
         updated_at = NOW()
     RETURNING id, school_id, name, to_char(holiday_date, 'YYYY-MM-DD') as holiday_date,
               holiday_type, description, is_active, created_at, updated_at`,
    [schoolId, name, cleanDate, holidayType, data.description || null]
  );

  return res.rows[0];
}

/**
 * Update holiday details or active status
 */
export async function updateSchoolHoliday(
  schoolId: string,
  holidayId: string,
  data: {
    name?: string;
    holiday_type?: 'GAZETTED' | 'NATIONAL' | 'REGIONAL' | 'INSTITUTIONAL' | 'FESTIVAL';
    description?: string;
    is_active?: boolean;
  }
): Promise<SchoolHoliday | null> {
  await ensureCalendarTables();

  if (!isPostgresConfigured) {
    const list = memHolidays[schoolId] || [];
    const item = list.find(h => h.id === holidayId);
    if (!item) return null;
    if (data.name !== undefined) item.name = data.name.trim();
    if (data.holiday_type !== undefined) item.holiday_type = data.holiday_type;
    if (data.description !== undefined) item.description = data.description;
    if (data.is_active !== undefined) item.is_active = data.is_active;
    item.updated_at = new Date().toISOString();
    return item;
  }

  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [holidayId, schoolId];

  if (data.name !== undefined) {
    params.push(data.name.trim());
    setClauses.push(`name = $${params.length}`);
  }
  if (data.holiday_type !== undefined) {
    params.push(data.holiday_type);
    setClauses.push(`holiday_type = $${params.length}`);
  }
  if (data.description !== undefined) {
    params.push(data.description);
    setClauses.push(`description = $${params.length}`);
  }
  if (data.is_active !== undefined) {
    params.push(data.is_active);
    setClauses.push(`is_active = $${params.length}`);
  }

  const res = await pool.query(
    `UPDATE school_holidays
     SET ${setClauses.join(', ')}
     WHERE id = $1 AND school_id = $2
     RETURNING id, school_id, name, to_char(holiday_date, 'YYYY-MM-DD') as holiday_date,
               holiday_type, description, is_active, created_at, updated_at`,
    params
  );

  return res.rows[0] || null;
}

/**
 * Add or upsert a date range of school holidays (inclusive from `from_date` to `to_date`)
 */
export async function addSchoolHolidayRange(
  schoolId: string,
  data: {
    name: string;
    from_date: string; // YYYY-MM-DD
    to_date: string;   // YYYY-MM-DD
    holiday_type?: 'GAZETTED' | 'NATIONAL' | 'REGIONAL' | 'INSTITUTIONAL' | 'FESTIVAL';
    description?: string;
  }
): Promise<SchoolHoliday[]> {
  await ensureCalendarTables();

  const cleanFrom = data.from_date.trim();
  const cleanTo = data.to_date.trim();
  const startUtc = parseYMDToUtc(cleanFrom);
  const endUtc = parseYMDToUtc(cleanTo);

  if (startUtc > endUtc) {
    throw new Error(`From date (${cleanFrom}) cannot be after To date (${cleanTo}).`);
  }

  const diffDays = Math.round((endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays > 366) {
    throw new Error(`Date range (${diffDays} days) cannot exceed 366 days.`);
  }

  const holidayType = data.holiday_type || 'GAZETTED';
  const name = data.name.trim();
  const desc = data.description || '';

  const results: SchoolHoliday[] = [];
  const current = new Date(startUtc.getTime());

  while (current <= endUtc) {
    const curDateStr = formatDateYMD(current);
    const item = await addSchoolHoliday(schoolId, {
      name,
      holiday_date: curDateStr,
      holiday_type: holidayType,
      description: desc
    });
    results.push(item);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return results;
}

/**
 * Delete a holiday record, optionally removing all dates in the series with matching name
 */
export async function deleteSchoolHoliday(
  schoolId: string,
  holidayId: string,
  deleteAllMatchingName: boolean = false
): Promise<boolean> {
  await ensureCalendarTables();

  if (!isPostgresConfigured) {
    const list = memHolidays[schoolId] || [];
    const target = list.find(h => h.id === holidayId);
    if (!target) return false;
    if (deleteAllMatchingName) {
      memHolidays[schoolId] = list.filter(h => h.name !== target.name);
      return true;
    } else {
      const idx = list.findIndex(h => h.id === holidayId);
      list.splice(idx, 1);
      return true;
    }
  }

  if (deleteAllMatchingName) {
    const holRes = await pool.query(
      `SELECT name FROM school_holidays WHERE id = $1 AND school_id = $2`,
      [holidayId, schoolId]
    );
    if (holRes.rows.length === 0) return false;
    const holName = holRes.rows[0].name;
    const res = await pool.query(
      `DELETE FROM school_holidays WHERE school_id = $1 AND name = $2`,
      [schoolId, holName]
    );
    return (res.rowCount || 0) > 0;
  }

  const res = await pool.query(
    `DELETE FROM school_holidays WHERE id = $1 AND school_id = $2`,
    [holidayId, schoolId]
  );
  return (res.rowCount || 0) > 0;
}

/**
 * Core Working Calendar & Holiday Calculation Engine
 * 
 * Accurately determines:
 * - Total calendar days (inclusive of startDate and endDate)
 * - Weekend days (per school configuration & Saturday rule)
 * - Active Gazetted/Institutional holidays
 * - Deduplication: A date that is BOTH a weekend and a holiday is counted as ONE non-working day.
 * - Invariant: totalDays = workingDays + nonWorkingDays.
 */
export async function calculateWorkingCalendar(
  schoolId: string,
  startDateStr: string,
  endDateStr: string,
  options?: {
    customWorkingDays?: number[];
    customWeekendDays?: number[];
    customSaturdayRule?: 'WORKING' | 'HALF_DAY' | 'OFF';
  }
): Promise<CalendarCalculationResult> {
  // 1. Validate dates and boundaries
  const startUtc = parseYMDToUtc(startDateStr);
  const endUtc = parseYMDToUtc(endDateStr);

  if (startUtc > endUtc) {
    throw new Error(`Start date (${startDateStr}) cannot be after end date (${endDateStr}).`);
  }

  // 2. Fetch School Working Days Configuration
  const savedConfig = await getSchoolWorkingDays(schoolId);
  const workingDays = options?.customWorkingDays || savedConfig.working_days || [1, 2, 3, 4, 5, 6];
  const weekendDays = options?.customWeekendDays || savedConfig.weekend_days || [0];
  const saturdayRule = options?.customSaturdayRule || savedConfig.saturday_rule || 'WORKING';

  // 3. Fetch active holidays in date range
  const holidays = await listSchoolHolidays(schoolId, {
    startDate: startDateStr,
    endDate: endDateStr,
    includeInactive: false
  });

  const holidayMap = new Map<string, SchoolHoliday>();
  for (const h of holidays) {
    holidayMap.set(h.holiday_date, h);
  }

  // 4. Iterate inclusive range day-by-day
  const breakdown: CalendarDayBreakdown[] = [];
  let totalDays = 0;
  let workingDaysCount = 0;
  let nonWorkingDaysCount = 0;
  let weekendDaysCount = 0;
  let holidayDaysCount = 0;
  let overlapDaysCount = 0;
  let halfDaysCount = 0;

  const current = new Date(startUtc.getTime());

  while (current <= endUtc) {
    const dateStr = formatDateYMD(current);
    const dayOfWeek = current.getUTCDay(); // 0=Sun..6=Sat
    const dayName = DAY_NAMES[dayOfWeek];

    // Determine weekend & half-day status
    let isWeekend = false;
    let isHalfDay = false;

    if (dayOfWeek === 6) { // Saturday
      if (saturdayRule === 'OFF') {
        isWeekend = true;
      } else if (saturdayRule === 'HALF_DAY') {
        isHalfDay = true;
      } else {
        isWeekend = weekendDays.includes(6) || !workingDays.includes(6);
      }
    } else {
      isWeekend = weekendDays.includes(dayOfWeek) || !workingDays.includes(dayOfWeek);
    }

    // Determine holiday status
    const holiday = holidayMap.get(dateStr);
    const isHoliday = !!holiday;

    // Deduplication check: Is it BOTH a weekend and a holiday?
    const isWeekendAndHoliday = isWeekend && isHoliday;

    let status: 'WORKING_DAY' | 'HALF_DAY' | 'WEEKEND' | 'HOLIDAY' | 'WEEKEND_AND_HOLIDAY';
    let workingWeight = 0;

    if (isWeekendAndHoliday) {
      status = 'WEEKEND_AND_HOLIDAY';
      workingWeight = 0;
      weekendDaysCount++;
      holidayDaysCount++;
      overlapDaysCount++;
      nonWorkingDaysCount += 1; // Counted ONCE, never double-counted!
    } else if (isHoliday) {
      status = 'HOLIDAY';
      workingWeight = 0;
      holidayDaysCount++;
      nonWorkingDaysCount += 1;
    } else if (isWeekend) {
      status = 'WEEKEND';
      workingWeight = 0;
      weekendDaysCount++;
      nonWorkingDaysCount += 1;
    } else if (isHalfDay) {
      status = 'HALF_DAY';
      workingWeight = 0.5;
      halfDaysCount++;
      workingDaysCount += 0.5;
      nonWorkingDaysCount += 0.5;
    } else {
      status = 'WORKING_DAY';
      workingWeight = 1;
      workingDaysCount += 1;
    }

    totalDays++;
    breakdown.push({
      date: dateStr,
      dayOfWeek,
      dayName,
      isWeekend,
      isHoliday,
      isWeekendAndHoliday,
      isHalfDay,
      holidayName: holiday?.name || null,
      holidayType: holiday?.holiday_type || null,
      status,
      workingWeight
    });

    // Advance 1 day safely in UTC
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    schoolId,
    startDate: startDateStr,
    endDate: endDateStr,
    totalDays,
    workingDays: workingDaysCount,
    nonWorkingDays: nonWorkingDaysCount,
    weekendDays: weekendDaysCount,
    holidayDays: holidayDaysCount,
    overlapDays: overlapDaysCount,
    halfDays: halfDaysCount,
    saturdayRule,
    breakdown
  };
}

/**
 * Check if a specific single date is an instructional working day or a non-instructional day (weekend/holiday)
 */
export async function checkInstructionalDate(
  schoolId: string,
  dateStr: string
): Promise<{
  date: string;
  isInstructional: boolean;
  reason?: string;
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}> {
  const result = await calculateWorkingCalendar(schoolId, dateStr, dateStr);
  const day = result.breakdown[0];

  let isInstructional = true;
  let reason: string | undefined = undefined;

  if (day.isWeekendAndHoliday) {
    isInstructional = false;
    reason = `Declared Holiday (${day.holidayName}) falling on ${day.dayName}`;
  } else if (day.isHoliday) {
    isInstructional = false;
    reason = `Declared Holiday: ${day.holidayName} (${day.holidayType || 'Gazetted'})`;
  } else if (day.isWeekend) {
    isInstructional = false;
    reason = `Scheduled Weekend (${day.dayName})`;
  }

  return {
    date: dateStr,
    isInstructional,
    reason,
    dayName: day.dayName,
    isWeekend: day.isWeekend,
    isHoliday: day.isHoliday,
    holidayName: day.holidayName || undefined
  };
}
