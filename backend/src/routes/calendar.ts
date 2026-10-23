import { Router, Request, Response } from 'express';
import { requireRoles } from '../middleware/auth';
import {
  getSchoolWorkingDays,
  updateSchoolWorkingDays,
  listSchoolHolidays,
  addSchoolHoliday,
  addSchoolHolidayRange,
  updateSchoolHoliday,
  deleteSchoolHoliday,
  calculateWorkingCalendar,
  checkInstructionalDate
} from '../services/calendarService';

const router = Router();

// Helper to extract school ID with strict multi-tenant authorization
function getAuthenticatedSchoolId(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;
  // Super admin can specify ?schoolId= or default to their assigned school
  if (user.role === 'SUPER_ADMIN') {
    return (req.query.schoolId as string) || (req.body?.schoolId as string) || user.schoolId || '00000000-0000-0000-0000-000000000001';
  }
  return user.schoolId || null;
}

const adminOnly = requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN');
const staffOrAdmin = requireRoles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER');

/**
 * GET /api/calendar/working-days
 * Get configured working days and weekend rules for the school
 */
router.get('/working-days', staffOrAdmin, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  try {
    const config = await getSchoolWorkingDays(schoolId);
    return res.json({ success: true, data: config });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch working days configuration.' });
  }
});

/**
 * PUT /api/calendar/working-days
 * Update working days and weekend rules (School Admin only)
 */
router.put('/working-days', adminOnly, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  const { working_days, weekend_days, saturday_rule } = req.body;

  if (saturday_rule && !['WORKING', 'HALF_DAY', 'OFF'].includes(saturday_rule)) {
    return res.status(400).json({
      success: false,
      message: "saturday_rule must be one of 'WORKING', 'HALF_DAY', or 'OFF'."
    });
  }

  if (working_days && (!Array.isArray(working_days) || working_days.some((d: any) => typeof d !== 'number' || d < 0 || d > 6))) {
    return res.status(400).json({
      success: false,
      message: 'working_days must be an array of integers between 0 (Sun) and 6 (Sat).'
    });
  }

  try {
    const updated = await updateSchoolWorkingDays(schoolId, {
      working_days,
      weekend_days,
      saturday_rule
    });
    return res.json({
      success: true,
      message: 'Institutional working calendar rules updated successfully.',
      data: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update working days configuration.' });
  }
});

/**
 * GET /api/calendar/holidays
 * List declared holidays for the school
 */
router.get('/holidays', staffOrAdmin, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const includeInactive = req.query.includeInactive === 'true';
  const holidayType = req.query.holidayType as string;

  try {
    const list = await listSchoolHolidays(schoolId, {
      startDate,
      endDate,
      includeInactive,
      holidayType
    });
    return res.json({ success: true, data: list, count: list.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to list holidays.' });
  }
});

/**
 * POST /api/calendar/holidays
 * Create or declare a single-day or multi-day holiday (From Date to To Date) for the school
 */
router.post('/holidays', adminOnly, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  const { name, holiday_date, from_date, to_date, start_date, end_date, holiday_type, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Holiday name is mandatory.' });
  }

  const effectiveFrom = (from_date || start_date || holiday_date || '').trim();
  const effectiveTo = (to_date || end_date || effectiveFrom).trim();

  if (!effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return res.status(400).json({ success: false, message: 'Valid From date in YYYY-MM-DD format is mandatory.' });
  }

  if (!effectiveTo || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo)) {
    return res.status(400).json({ success: false, message: 'Valid To date in YYYY-MM-DD format is mandatory.' });
  }

  if (effectiveFrom > effectiveTo) {
    return res.status(400).json({ success: false, message: 'From date cannot be after To date.' });
  }

  try {
    if (effectiveFrom === effectiveTo) {
      const created = await addSchoolHoliday(schoolId, {
        name: name.trim(),
        holiday_date: effectiveFrom,
        holiday_type: holiday_type || 'GAZETTED',
        description
      });
      return res.status(201).json({
        success: true,
        message: `Declared holiday '${created.name}' on ${created.holiday_date}.`,
        data: created,
        items: [created],
        count: 1
      });
    } else {
      const createdList = await addSchoolHolidayRange(schoolId, {
        name: name.trim(),
        from_date: effectiveFrom,
        to_date: effectiveTo,
        holiday_type: holiday_type || 'GAZETTED',
        description
      });
      return res.status(201).json({
        success: true,
        message: `Declared holiday '${name.trim()}' for ${createdList.length} days (${effectiveFrom} to ${effectiveTo}).`,
        data: createdList[0],
        items: createdList,
        count: createdList.length
      });
    }
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message || 'Failed to add holiday.' });
  }
});

/**
 * PUT /api/calendar/holidays/:id
 * Update holiday details or active status
 */
router.put('/holidays/:id', adminOnly, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  const holidayId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const { name, holiday_type, description, is_active } = req.body;

  try {
    const updated = await updateSchoolHoliday(schoolId, holidayId, {
      name,
      holiday_type,
      description,
      is_active
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Holiday record not found or access denied.' });
    }

    return res.json({
      success: true,
      message: 'Holiday updated successfully.',
      data: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update holiday.' });
  }
});

/**
 * DELETE /api/calendar/holidays/:id
 * Delete a holiday record
 */
router.delete('/holidays/:id', adminOnly, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  const holidayId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
  const deleteAllSeries = req.query.allSeries === 'true' || req.query.deleteAll === 'true';

  try {
    const deleted = await deleteSchoolHoliday(schoolId, holidayId, deleteAllSeries);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Holiday not found or already removed.' });
    }
    return res.json({
      success: true,
      message: deleteAllSeries ? 'Holiday series removed successfully.' : 'Holiday removed successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete holiday.' });
  }
});

/**
 * GET /api/calendar/calculate
 * Calculate working days, weekend dates, and holidays with strict deduplication
 */
router.get('/calculate', staffOrAdmin, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Both startDate and endDate query parameters are required in YYYY-MM-DD format.'
    });
  }

  const customSaturdayRule = req.query.saturdayRule as 'WORKING' | 'HALF_DAY' | 'OFF' | undefined;

  try {
    const result = await calculateWorkingCalendar(schoolId, startDate, endDate, {
      customSaturdayRule
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message || 'Calendar calculation failed.' });
  }
});

/**
 * GET /api/calendar/check-date
 * Check if a date is instructional or non-instructional (Weekend/Holiday Guard for TC-ATT-010)
 */
router.get('/check-date', staffOrAdmin, async (req: Request, res: Response) => {
  const schoolId = getAuthenticatedSchoolId(req);
  if (!schoolId) {
    return res.status(403).json({ success: false, message: 'Institutional school context required.' });
  }

  const date = (req.query.date as string) || (req.query.attendance_date as string);
  if (!date) {
    return res.status(400).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD).' });
  }

  try {
    const check = await checkInstructionalDate(schoolId, date);
    return res.json({ success: true, data: check });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message || 'Date check failed.' });
  }
});

export default router;
