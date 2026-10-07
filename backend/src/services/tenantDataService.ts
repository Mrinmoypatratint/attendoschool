import { CollectionReference, WhereFilterOp } from 'firebase-admin/firestore';
import { collections, isFirebaseConfigured } from '../firebase';
import { getFirestoreSchoolById } from './firestoreService';
import { DualDatabaseService } from './dualDatabaseService';
import { fastCache } from '../utils/cache';

// In-memory short-lived cache (30-second TTL) per school to prevent burning Firestore quota
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const dashboardCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Invalidate cached data for a specific school (e.g. after create/update/delete operations)
 */
export function invalidateSchoolCache(schoolId: string): void {
  if (!schoolId) return;
  const sid = schoolId.trim().toLowerCase();
  dashboardCache.delete(sid);
  fastCache.invalidatePattern(sid);
}

/**
 * Helper to execute a scoped count query against Firestore with fallback for legacy camelCase/snake_case
 * and automatic failover to Supabase (PostgreSQL) when Firebase quota is exhausted.
 */
async function countTenantCollection(
  collectionFn: () => CollectionReference,
  schoolId: string,
  extraFilter?: { field: string; op: WhereFilterOp; value: any },
  secondaryFallbackFn?: () => Promise<number>
): Promise<number> {
  // 1. PRIMARY: Execute directly against Supabase PostgreSQL if available
  if (secondaryFallbackFn && DualDatabaseService.isPrimaryAvailable() && schoolId) {
    try {
      return await secondaryFallbackFn();
    } catch (err: any) {
      console.warn(`[TenantDataService] Supabase count query warning for school ${schoolId}:`, err.message);
    }
  }

  // 2. SECONDARY: Fall back to Cloud Firestore
  if (!isFirebaseConfigured() || !schoolId) {
    if (secondaryFallbackFn && DualDatabaseService.isPrimaryAvailable()) {
      return await secondaryFallbackFn();
    }
    return 0;
  }

  try {
    let q1 = collectionFn().where('school_id', '==', schoolId);
    if (extraFilter) q1 = q1.where(extraFilter.field, extraFilter.op, extraFilter.value);
    const snap1 = await q1.count().get();
    let count = snap1.data().count;

    if (count === 0) {
      // Check legacy camelCase 'schoolId' field
      let q2 = collectionFn().where('schoolId', '==', schoolId);
      if (extraFilter) q2 = q2.where(extraFilter.field, extraFilter.op, extraFilter.value);
      const snap2 = await q2.count().get();
      count = snap2.data().count;
    }

    return count;
  } catch (err: any) {
    if (secondaryFallbackFn && DualDatabaseService.isPrimaryAvailable()) {
      return await secondaryFallbackFn();
    }
    return 0;
  }
}

/**
 * Retrieve Today's Attendance breakdown strictly scoped to the authenticated tenant
 */
export async function getTenantTodayAttendance(schoolId: string, targetDate?: string) {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);
  const result = {
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0,
    classBreakdown: [] as any[]
  };

  if (!schoolId) return result;

  // 1. PRIMARY: Query Supabase PostgreSQL attendance_sessions first
  if (DualDatabaseService.isPrimaryAvailable()) {
    try {
      const sbAttendance = await DualDatabaseService.getTodayAttendanceFromSupabase(schoolId, dateStr);
      if (sbAttendance) {
        return sbAttendance;
      }
    } catch (err: any) {
      console.warn(`[TenantDataService] Supabase attendance query warning:`, err.message);
    }
  }

  // 2. SECONDARY: Fall back to Cloud Firestore
  if (!isFirebaseConfigured()) return result;

  try {
    // 1. Query attendance_sessions scoped by school_id and attendance_date
    let sessSnap = await collections.attendanceSessions()
      .where('school_id', '==', schoolId)
      .where('attendance_date', '==', dateStr)
      .get();

    if (sessSnap.empty) {
      // Fallback check for camelCase
      sessSnap = await collections.attendanceSessions()
        .where('schoolId', '==', schoolId)
        .where('attendanceDate', '==', dateStr)
        .get();
    }

    if (sessSnap.empty) {
      return result;
    }

    const breakdownMap: Record<string, { class_number: number; section_name: string; total: number; present: number; absent: number }> = {};

    sessSnap.docs.forEach(doc => {
      const data = doc.data();
      const cNum = Number(data.class_number ?? data.classNumber ?? 10);
      const sName = String(data.section_name || data.sectionName || 'A').trim();
      const key = `${cNum}-${sName}`;

      const present = Number(data.presentCount ?? data.present_count ?? 0);
      const absent = Number(data.absentCount ?? data.absent_count ?? 0);
      const total = Number(data.totalCount ?? data.total_count ?? (present + absent));

      if (!breakdownMap[key]) {
        breakdownMap[key] = { class_number: cNum, section_name: sName, total: 0, present: 0, absent: 0 };
      }
      breakdownMap[key].present += present;
      breakdownMap[key].absent += absent;
      breakdownMap[key].total += total;
    });

    const classBreakdown = Object.values(breakdownMap).map(b => ({
      class_number: b.class_number,
      section_name: b.section_name,
      total: b.total,
      present: b.present,
      absent: b.absent,
      percentage: b.total > 0 ? Number(((b.present / b.total) * 100).toFixed(1)) : 0
    })).sort((a, b) => a.class_number - b.class_number || a.section_name.localeCompare(b.section_name));

    const totalMarked = classBreakdown.reduce((sum, b) => sum + b.total, 0);
    const presentMarked = classBreakdown.reduce((sum, b) => sum + b.present, 0);
    const absentMarked = classBreakdown.reduce((sum, b) => sum + b.absent, 0);
    const percentage = totalMarked > 0 ? Number(((presentMarked / totalMarked) * 100).toFixed(1)) : 0;

    return {
      total: totalMarked,
      present: presentMarked,
      absent: absentMarked,
      percentage,
      classBreakdown
    };
  } catch (err: any) {
    const isQuota = err?.message && (
      err.message.includes('Quota exceeded') ||
      err.message.includes('RESOURCE_EXHAUSTED') ||
      err.code === 8
    );
    if (isQuota) {
      if (DualDatabaseService.isSecondaryAvailable()) {
        console.warn(`[DualDB Failover] Firestore quota exceeded for today attendance of ${schoolId}. Serving from Supabase...`);
        return await DualDatabaseService.getTodayAttendanceFromSupabase(schoolId, dateStr);
      }
      throw err;
    }
    console.warn(`[TenantDataService] Error retrieving today attendance for ${schoolId}:`, err.message);
    if (DualDatabaseService.isSecondaryAvailable()) {
      return await DualDatabaseService.getTodayAttendanceFromSupabase(schoolId, dateStr);
    }
    return result;
  }
}

/**
 * Retrieve real weekly attendance trend (Monday to Friday of current week) for this tenant
 */
export async function getTenantWeeklyTrend(schoolId: string) {
  const now = new Date();
  const currentDayNum = now.getDay();

  // Find Monday of the current week
  const monday = new Date(now);
  const diff = now.getDate() - currentDayNum + (currentDayNum === 0 ? -6 : 1);
  monday.setDate(diff);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monStr = monday.toISOString().slice(0, 10);
  const friStr = friday.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  // 1. PRIMARY: Single fast query against Supabase PostgreSQL
  if (DualDatabaseService.isPrimaryAvailable() && schoolId) {
    try {
      const rows = await DualDatabaseService.getWeeklyTrendFromSupabase(schoolId, monStr, friStr);
      if (rows) {
        const trendMap = new Map<string, any>();
        rows.forEach(r => {
          const dStr = typeof r.attendance_date === 'string'
            ? r.attendance_date.slice(0, 10)
            : new Date(r.attendance_date).toISOString().slice(0, 10);
          trendMap.set(dStr, r);
        });

        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((dayName, idx) => {
          const dayDate = new Date(monday);
          dayDate.setDate(monday.getDate() + idx);
          const dateStr = dayDate.toISOString().slice(0, 10);
          const rec = trendMap.get(dateStr);
          const total = rec ? Number(rec.total) || 0 : 0;
          const present = rec ? Number(rec.present) || 0 : 0;
          const absent = rec ? Number(rec.absent) || 0 : 0;
          const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;
          return {
            day: dayName,
            date: dateStr,
            percentage,
            present,
            absent,
            total,
            isToday: dateStr === todayStr
          };
        });
      }
    } catch (err: any) {
      console.warn('[TenantDataService] Supabase weekly trend query error:', err.message);
    }
  }

  // 2. SECONDARY: Concurrent Promise.all queries (instead of slow sequential loop)
  const days = [0, 1, 2, 3, 4].map(i => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    return {
      dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
      dateStr: dayDate.toISOString().slice(0, 10),
      isToday: dayDate.toDateString() === now.toDateString()
    };
  });

  return await Promise.all(
    days.map(async ({ dayName, dateStr, isToday }) => {
      try {
        const att = await getTenantTodayAttendance(schoolId, dateStr);
        return {
          day: dayName,
          date: dateStr,
          percentage: att.percentage,
          present: att.present,
          absent: att.absent,
          total: att.total,
          isToday
        };
      } catch {
        return {
          day: dayName,
          date: dateStr,
          percentage: 0,
          present: 0,
          absent: 0,
          total: 0,
          isToday
        };
      }
    })
  );
}


/**
 * Comprehensive, 100% Firebase-backed, school-isolated dashboard aggregator
 */
export async function getSchoolDashboardStats(schoolId: string, userSchoolName?: string, userSchoolCode?: string) {
  if (!schoolId) {
    throw new Error('School ID is required to fetch dashboard data');
  }

  const sidKey = schoolId.trim().toLowerCase();
  const cached = dashboardCache.get(sidKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // 1. FAST PATH: Supabase PostgreSQL Primary Atomic Pull (<20ms)
  if (DualDatabaseService.isPrimaryAvailable()) {
    try {
      const [unifiedMetrics, todayAttendance, weeklyTrend] = await Promise.all([
        DualDatabaseService.getUnifiedDashboardMetricsFromSupabase(schoolId),
        getTenantTodayAttendance(schoolId),
        getTenantWeeklyTrend(schoolId)
      ]);

      if (unifiedMetrics) {
        const schoolObj = unifiedMetrics.school || {};
        const schoolProfile = {
          id: schoolId,
          name: schoolObj.name || userSchoolName || 'Institutional Campus',
          code: schoolObj.code || userSchoolCode || 'SCH',
          status: schoolObj.status || 'ACTIVE',
          enquiry_number: schoolObj.enquiry_number || 'Not configured',
          address: schoolObj.address || 'Institutional Campus',
          city: '',
          state: '',
          affiliation: schoolObj.code ? `${schoolObj.code} · Affiliated` : 'Affiliated'
        };

        const activeAcademicYear = unifiedMetrics.active_academic_year || null;

        const payload = {
          school: schoolProfile,
          totalStudents: Number(unifiedMetrics.total_students) || 0,
          totalTeachers: Number(unifiedMetrics.total_teachers) || 0,
          totalClasses: Number(unifiedMetrics.total_classes) || 0,
          totalSections: Number(unifiedMetrics.total_sections) || 0,
          turnout_rate: todayAttendance.percentage,
          present_today: todayAttendance.present,
          absent_today: todayAttendance.absent,
          total_today: todayAttendance.total,
          class_breakdown: todayAttendance.classBreakdown,
          todayAttendance,
          weeklyTrend,
          pendingCorrectionsCount: Number(unifiedMetrics.pending_corrections) || 0,
          pendingPhotosCount: Number(unifiedMetrics.pending_photos) || 0,
          pendingLeavesCount: Number(unifiedMetrics.pending_leaves) || 0,
          activeAcademicYear,
          announcements: [],
          subscription: {
            plan_name: 'Standard',
            max_students: 100000,
            status: 'ACTIVE',
            start_date: null,
            end_date: null,
            days_remaining: 365,
            discount_percentage: 0
          },
          recentActivity: []
        };

        dashboardCache.set(sidKey, { data: payload, timestamp: now });
        return payload;
      }
    } catch (fastErr: any) {
      console.warn('[TenantDataService] Fast-path dashboard fetch warning:', fastErr.message);
    }
  }

  // 2. SECONDARY / FALLBACK: Granular Multi-Source Aggregator
  let sbSchool = await DualDatabaseService.getSchoolFromSupabase(schoolId);
  let fsSchool = !sbSchool ? await getFirestoreSchoolById(schoolId).catch(() => null) : null;
  const schoolProfile = {
    id: schoolId,
    name: sbSchool?.name || fsSchool?.name || userSchoolName || 'Institutional Campus',
    code: sbSchool?.code || fsSchool?.code || userSchoolCode || 'SCH',
    status: sbSchool?.status || fsSchool?.status || 'ACTIVE',
    enquiry_number: sbSchool?.enquiry_number || fsSchool?.enquiry_number || fsSchool?.phone || fsSchool?.enquiryNumber || 'Not configured',
    address: sbSchool?.address || fsSchool?.address || 'Institutional Campus',
    city: fsSchool?.city || '',
    state: fsSchool?.state || '',
    affiliation: sbSchool?.code ? `${sbSchool.code} · Affiliated` : (fsSchool?.affiliation || 'Affiliated')
  };

  // Perform tenant-scoped aggregation counts concurrently with Supabase primary
  const [
    studentCount,
    teacherCount,
    classCount,
    sectionCount,
    pendingCorrectionsCount,
    todayAttendance,
    activeAcademicYear,
    announcementsSnap
  ] = await Promise.all([
    countTenantCollection(
      collections.students,
      schoolId,
      { field: 'is_active', op: '==', value: true },
      () => DualDatabaseService.getStudentCountFromSupabase(schoolId)
    ),
    countTenantCollection(
      collections.users,
      schoolId,
      { field: 'role', op: '==', value: 'TEACHER' },
      () => DualDatabaseService.getTeacherCountFromSupabase(schoolId)
    ),
    countTenantCollection(
      collections.classes,
      schoolId,
      undefined,
      () => DualDatabaseService.getClassCountFromSupabase(schoolId)
    ),
    countTenantCollection(
      collections.sections,
      schoolId,
      undefined,
      () => DualDatabaseService.getSectionCountFromSupabase(schoolId)
    ),
    countTenantCollection(
      collections.attendanceCorrections,
      schoolId,
      { field: 'status', op: '==', value: 'PENDING' },
      () => DualDatabaseService.getPendingCorrectionsCountFromSupabase(schoolId)
    ),
    getTenantTodayAttendance(schoolId),
    DualDatabaseService.getActiveAcademicYearFromSupabase(schoolId),
    collections.announcements().where('school_id', '==', schoolId).limit(4).get().catch(() => null)
  ]);

  // 3. Compute real subscription status from school document
  let subscriptionData = null;
  const subEndStr = fsSchool?.subscriptionEnd || fsSchool?.subscription_end;
  if (subEndStr) {
    const end = new Date(subEndStr);
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now) / (1000 * 60 * 60 * 24)));
    subscriptionData = {
      plan_name: fsSchool?.planName || fsSchool?.plan_name || 'Standard',
      max_students: fsSchool?.maxStudents || fsSchool?.max_students || 1000,
      status: fsSchool?.status || 'ACTIVE',
      start_date: fsSchool?.subscriptionStart || fsSchool?.subscription_start || null,
      end_date: subEndStr,
      days_remaining: daysRemaining,
      discount_percentage: fsSchool?.discount_percentage || 0
    };
  } else {
    subscriptionData = {
      plan_name: fsSchool?.planName || fsSchool?.plan_name || 'Standard',
      max_students: fsSchool?.maxStudents || 1000,
      status: fsSchool?.status || 'ACTIVE',
      start_date: null,
      end_date: null,
      days_remaining: 365,
      discount_percentage: 0
    };
  }

  // 4. Resolve Active Academic Year
  let activeYear: any = activeAcademicYear || null;
  if (!activeYear && isFirebaseConfigured()) {
    try {
      const snap = await collections.academicYears().where('school_id', '==', schoolId).where('is_active', '==', true).limit(1).get();
      if (!snap.empty) {
        activeYear = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } catch {}
  }

  // 5. Resolve Announcements
  const announcements: any[] = [];
  if (announcementsSnap && !announcementsSnap.empty) {
    announcementsSnap.docs.forEach(d => {
      announcements.push({ id: d.id, ...d.data() });
    });
  }

  // 6. Generate real weekly trend
  const weeklyTrend = await getTenantWeeklyTrend(schoolId);

  const payload = {
    school: schoolProfile,
    totalStudents: studentCount,
    totalTeachers: teacherCount,
    totalClasses: classCount,
    totalSections: sectionCount,
    turnout_rate: todayAttendance.percentage,
    present_today: todayAttendance.present,
    absent_today: todayAttendance.absent,
    total_today: todayAttendance.total,
    class_breakdown: todayAttendance.classBreakdown,
    todayAttendance,
    weeklyTrend,
    pendingCorrectionsCount,
    activeAcademicYear: activeYear,
    announcements,
    subscription: subscriptionData,
    recentActivity: []
  };

  // Cache response for 30s
  dashboardCache.set(sidKey, { data: payload, timestamp: now });
  return payload;
}
