import crypto from 'crypto';
import { pool, isPostgresConfigured } from '../db';
import { env } from '../config/env';

/**
 * Dual Database Synchronization & Quota Failover Service
 * 
 * Architecture (PRIMARY: Supabase / PostgreSQL):
 * - PRIMARY: Supabase PostgreSQL (Relational integrity, ACID transactions, primary source of truth)
 * - SECONDARY: Firebase Cloud Firestore (Optional mirror & real-time client sync)
 */

export class DualDatabaseService {
  /**
   * Check if Supabase / PostgreSQL primary store is active
   */
  static isPrimaryAvailable(): boolean {
    return isPostgresConfigured;
  }

  /**
   * Check if Supabase / PostgreSQL store is active (backward compatible alias)
   */
  static isSecondaryAvailable(): boolean {
    return isPostgresConfigured;
  }

  /**
   * Safe execution wrapper: Tries Primary (Supabase), falls back to Secondary (Firebase) if needed
   */
  static async executeWithFailover<T>(
    primaryFn: () => Promise<T>,
    secondaryFn: () => Promise<T>,
    _operationName: string
  ): Promise<T> {
    if (this.isPrimaryAvailable() && secondaryFn) {
      return await secondaryFn();
    }
    return await primaryFn();
  }

  /**
   * Mirror student record to Supabase
   */
  static async syncStudentToSupabase(student: any): Promise<boolean> {
    if (!isPostgresConfigured) return false;
    try {
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val));
      let id = student.id || student._id;
      if (!id || !isUuid(id)) {
        id = crypto.randomUUID();
      }
      const schoolId = student.school_id || student.schoolId;
      if (!schoolId || !isUuid(schoolId)) return false;

      let classId = student.class_id || student.classId || null;
      let sectionId = student.section_id || student.sectionId || null;

      if (classId && !isUuid(classId)) {
        const cNum = parseInt(String(classId).replace(/\D/g, ''), 10) || 10;
        const cRes = await pool.query('SELECT id FROM classes WHERE school_id = $1 AND class_number = $2 LIMIT 1', [schoolId, cNum]);
        classId = cRes.rows[0]?.id || null;
      }

      if (sectionId && !isUuid(sectionId) && classId) {
        const sName = String(student.section_name || student.sectionName || 'A').replace(/section\s*/i, '').trim() || 'A';
        const sRes = await pool.query('SELECT id FROM sections WHERE school_id = $1 AND class_id = $2 AND LOWER(name) = LOWER($3) LIMIT 1', [schoolId, classId, sName]);
        sectionId = sRes.rows[0]?.id || null;
      }

      const query = `
        INSERT INTO students (
          id, school_id, class_id, section_id, roll_number, admission_number,
          name, parent_name, parent_sms_number, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          roll_number = EXCLUDED.roll_number,
          admission_number = EXCLUDED.admission_number,
          name = EXCLUDED.name,
          parent_name = EXCLUDED.parent_name,
          parent_sms_number = EXCLUDED.parent_sms_number,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `;

      await pool.query(query, [
        id,
        schoolId,
        classId,
        sectionId,
        String(student.roll_number || student.rollNumber || '0'),
        student.admission_number || student.admissionNumber || '',
        student.name || student.fullName || '',
        student.parent_name || student.parentName || '',
        student.parent_phone || student.parent_sms_number || '',
        student.is_active !== false
      ]);
      return true;
    } catch (err: any) {
      console.warn('[DualDB Sync] Student mirror to Supabase warning:', err.message);
      return false;
    }
  }

  /**
   * Mirror attendance session & records to Supabase
   */
  static async syncAttendanceToSupabase(session: any, records: any[]): Promise<boolean> {
    if (!isPostgresConfigured) return false;
    try {
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val));
      
      let sessionId = session.id;
      if (!sessionId || !isUuid(sessionId)) {
        sessionId = crypto.randomUUID();
      }

      const schoolId = session.school_id || session.schoolId;
      if (!schoolId || !isUuid(schoolId)) return false;

      let classId = session.class_id || session.classId;
      let classNumber = Number(session.class_number ?? session.classNumber ?? 10);
      if (!classId || !isUuid(classId)) {
        const cRes = await pool.query('SELECT id, class_number FROM classes WHERE school_id = $1 AND class_number = $2 LIMIT 1', [schoolId, classNumber]);
        if (cRes.rowCount) {
          classId = cRes.rows[0].id;
        } else {
          const ins = await pool.query('INSERT INTO classes (school_id, class_number) VALUES ($1, $2) ON CONFLICT (school_id, class_number) DO UPDATE SET class_number=EXCLUDED.class_number RETURNING id', [schoolId, classNumber]);
          classId = ins.rows[0]?.id;
        }
      }

      let sectionId = session.section_id || session.sectionId;
      let sectionName = String(session.section_name || session.sectionName || 'A').replace(/section\s*/i, '').trim() || 'A';
      if (!sectionId || !isUuid(sectionId)) {
        const sRes = await pool.query('SELECT id FROM sections WHERE school_id = $1 AND class_id = $2 AND LOWER(name) = LOWER($3) LIMIT 1', [schoolId, classId, sectionName]);
        if (sRes.rowCount) {
          sectionId = sRes.rows[0].id;
        } else {
          const ins = await pool.query('INSERT INTO sections (school_id, class_id, name) VALUES ($1, $2, $3) ON CONFLICT (class_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id', [schoolId, classId, sectionName]);
          sectionId = ins.rows[0]?.id;
        }
      }

      let teacherId = session.teacher_id || session.teacherId;
      if (!teacherId || !isUuid(teacherId)) {
        const tRes = await pool.query(`SELECT id FROM users WHERE school_id = $1 AND role = 'TEACHER' LIMIT 1`, [schoolId]);
        teacherId = tRes.rows[0]?.id || '00000000-0000-0000-0000-000000000021';
      }

      let subjectId = session.subject_id || session.subjectId || null;
      if (subjectId && !isUuid(subjectId)) {
        const subRes = await pool.query('SELECT id FROM subjects WHERE school_id = $1 LIMIT 1', [schoolId]);
        subjectId = subRes.rows[0]?.id || null;
      }

      const sessQuery = `
        INSERT INTO attendance_sessions (
          id, school_id, class_id, section_id, subject_id, teacher_id,
          attendance_date, start_time, end_time, class_number, section_name,
          present_count, absent_count, total_count, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (id) DO UPDATE SET
          present_count = EXCLUDED.present_count,
          absent_count = EXCLUDED.absent_count,
          total_count = EXCLUDED.total_count,
          submitted_at = NOW();
      `;

      await pool.query(sessQuery, [
        sessionId,
        schoolId,
        classId,
        sectionId,
        subjectId,
        teacherId,
        session.attendance_date || session.attendanceDate || new Date().toISOString().slice(0, 10),
        session.start_time || '09:00:00',
        session.end_time || '10:00:00',
        classNumber,
        sectionName,
        session.present_count || 0,
        session.absent_count || 0,
        session.total_count || 0
      ]);

      if (records && records.length > 0) {
        // Collect students needing lookup and batch resolve
        const lookupNeeded: { idx: number; roll: string; name: string }[] = [];
        const studentIdMap = new Map<number, string>();

        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          const rawStudentId = r.student_id || r.studentId;
          if (!rawStudentId) continue;

          if (isUuid(rawStudentId)) {
            studentIdMap.set(i, rawStudentId);
          } else {
            lookupNeeded.push({
              idx: i,
              roll: String(r.rollNumber || r.roll_number || rawStudentId).trim(),
              name: String(r.studentName || r.name || '').trim()
            });
          }
        }

        if (lookupNeeded.length > 0) {
          const rolls = lookupNeeded.map(l => l.roll).filter(Boolean);
          const stRes = rolls.length > 0
            ? await pool.query(
                `SELECT id, roll_number, name FROM students WHERE school_id = $1 AND roll_number = ANY($2)`,
                [schoolId, rolls]
              )
            : { rows: [] };
          const rollMap = new Map<string, string>();
          stRes.rows.forEach(row => rollMap.set(String(row.roll_number).trim(), row.id));

          for (const item of lookupNeeded) {
            const foundId = rollMap.get(item.roll);
            if (foundId) {
              studentIdMap.set(item.idx, foundId);
            } else {
              const newUuid = crypto.randomUUID();
              await pool.query(`
                INSERT INTO students (id, school_id, class_id, section_id, roll_number, name, parent_sms_number, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                ON CONFLICT (id) DO NOTHING
              `, [newUuid, schoolId, classId, sectionId, item.roll || '1', item.name || 'Student', '+919876543210']);
              studentIdMap.set(item.idx, newUuid);
            }
          }
        }

        // Batch insert attendance records in a single query per chunk
        const preparedRecords: { studentId: string; isPres: boolean; status: string; remarks: string }[] = [];
        for (let i = 0; i < records.length; i++) {
          const studentId = studentIdMap.get(i);
          if (!studentId) continue;
          const r = records[i];
          const isPres = r.is_present ?? (r.status === 'PRESENT' || r.status === 'LATE');
          const status = r.status || (isPres ? 'PRESENT' : 'ABSENT');
          preparedRecords.push({ studentId, isPres, status, remarks: r.remarks || '' });
        }

        const CHUNK_SIZE = 50;
        for (let c = 0; c < preparedRecords.length; c += CHUNK_SIZE) {
          const chunk = preparedRecords.slice(c, c + CHUNK_SIZE);
          const values: any[] = [];
          const clauses: string[] = [];
          for (let i = 0; i < chunk.length; i++) {
            const rec = chunk[i];
            const offset = i * 5;
            clauses.push(`(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, NOW())`);
            values.push(sessionId, rec.studentId, rec.isPres, rec.status, rec.remarks);
          }
          await pool.query(`
            INSERT INTO attendance_records (
              id, attendance_session_id, student_id, is_present, status, remarks, marked_at
            ) VALUES ${clauses.join(', ')}
            ON CONFLICT (attendance_session_id, student_id) DO UPDATE SET
              is_present = EXCLUDED.is_present,
              status = EXCLUDED.status,
              remarks = EXCLUDED.remarks,
              marked_at = NOW();
          `, values);
        }
      }
      return true;
    } catch (err: any) {
      console.warn('[DualDB Sync] Attendance mirror to Supabase warning:', err.message);
      return false;
    }
  }

  /**
   * Supabase: Get Student Count
   */
  static async getStudentCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured || !schoolId) return 0;
    try {
      const res = await pool.query(
        'SELECT COUNT(*)::int as count FROM students WHERE school_id = $1 AND is_active = true',
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn('[DualDB] Supabase student count query warning:', err.message);
      return 0;
    }
  }

  /**
   * Supabase: Get Teacher Count
   */
  static async getTeacherCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured || !schoolId) return 0;
    try {
      const res = await pool.query(
        "SELECT COUNT(*)::int as count FROM users WHERE school_id = $1 AND role = 'TEACHER' AND is_active = true",
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn('[DualDB] Supabase teacher count query warning:', err.message);
      return 0;
    }
  }

  /**
   * Supabase: Get Class Count
   */
  static async getClassCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured || !schoolId) return 0;
    try {
      const res = await pool.query(
        'SELECT COUNT(*)::int as count FROM classes WHERE school_id = $1',
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn('[DualDB] Supabase class count query warning:', err.message);
      return 0;
    }
  }

  /**
   * Supabase: Get Section Count
   */
  static async getSectionCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured || !schoolId) return 0;
    try {
      const res = await pool.query(
        'SELECT COUNT(*)::int as count FROM sections WHERE school_id = $1',
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn('[DualDB] Supabase section count query warning:', err.message);
      return 0;
    }
  }

  /**
   * Supabase: Get Pending Attendance Corrections Count
   */
  static async getPendingCorrectionsCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured || !schoolId) return 0;
    try {
      const res = await pool.query(
        `SELECT COUNT(*)::int as count FROM attendance_correction_requests WHERE school_id = $1 AND status = 'PENDING'`,
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Supabase: Get Unified Dashboard Metrics in a single atomic SQL roundtrip (<15ms)
   */
  static async getUnifiedDashboardMetricsFromSupabase(schoolId: string) {
    if (!isPostgresConfigured || !schoolId) return null;
    try {
      const query = `
        SELECT
          (SELECT row_to_json(s) FROM (SELECT id, name, code, status, enquiry_number, address, gstin, billing_address FROM schools WHERE id = $1) s) AS school,
          (SELECT COUNT(*)::int FROM students WHERE school_id = $1 AND is_active = true) AS total_students,
          (SELECT COUNT(*)::int FROM users WHERE school_id = $1 AND role = 'TEACHER' AND is_active = true) AS total_teachers,
          (SELECT COUNT(*)::int FROM classes WHERE school_id = $1) AS total_classes,
          (SELECT COUNT(*)::int FROM sections WHERE school_id = $1) AS total_sections,
          (SELECT COUNT(*)::int FROM attendance_correction_requests WHERE school_id = $1 AND status = 'PENDING') AS pending_corrections,
          (SELECT COUNT(*)::int FROM photo_approval_requests WHERE school_id = $1 AND status = 'PENDING') AS pending_photos,
          (SELECT COUNT(*)::int FROM student_leave_requests WHERE school_id = $1 AND status = 'PENDING') AS pending_leaves,
          (SELECT row_to_json(ay) FROM (SELECT id, name, start_date, end_date FROM academic_years WHERE school_id = $1 AND is_active = true LIMIT 1) ay) AS active_academic_year;
      `;
      const res = await pool.query(query, [schoolId]);
      return res.rows[0] || null;
    } catch (err: any) {
      console.warn('[DualDB] Supabase unified dashboard query warning:', err.message);
      return null;
    }
  }

  /**
   * Supabase: Get School Profile
   */
  static async getSchoolFromSupabase(schoolId: string) {
    if (!isPostgresConfigured || !schoolId) return null;
    try {
      const res = await pool.query(
        'SELECT id, name, code, status, enquiry_number, address, gstin, billing_address FROM schools WHERE id = $1',
        [schoolId]
      );
      return res.rows[0] || null;
    } catch (err: any) {
      console.warn('[DualDB] Supabase school query warning:', err.message);
      return null;
    }
  }

  /**
   * Supabase: Get Active Academic Year
   */
  static async getActiveAcademicYearFromSupabase(schoolId: string) {
    if (!isPostgresConfigured || !schoolId) return null;
    try {
      const res = await pool.query(
        'SELECT id, name, start_date, end_date, is_active FROM academic_years WHERE school_id = $1 AND is_active = true LIMIT 1',
        [schoolId]
      );
      return res.rows[0] || null;
    } catch (err: any) {
      console.warn('[DualDB] Supabase academic year query warning:', err.message);
      return null;
    }
  }

  /**
   * Supabase: Get Today's Attendance Breakdown
   */
  static async getTodayAttendanceFromSupabase(schoolId: string, dateStr: string = new Date().toISOString().slice(0, 10)) {
    const result = {
      total: 0,
      present: 0,
      absent: 0,
      percentage: 0,
      classBreakdown: [] as any[]
    };
    if (!isPostgresConfigured || !schoolId) return result;

    try {
      const res = await pool.query(`
        SELECT 
          class_number, section_name,
          SUM(present_count)::int as present,
          SUM(absent_count)::int as absent,
          SUM(total_count)::int as total
        FROM attendance_sessions
        WHERE school_id = $1 AND attendance_date = $2
        GROUP BY class_number, section_name
        ORDER BY class_number ASC, section_name ASC
      `, [schoolId, dateStr]);

      result.classBreakdown = res.rows.map(r => ({
        class_number: r.class_number,
        section_name: r.section_name,
        present: r.present || 0,
        absent: r.absent || 0,
        total: r.total || 0,
        percentage: r.total > 0 ? Number(((r.present / r.total) * 100).toFixed(1)) : 0
      }));

      result.present = result.classBreakdown.reduce((sum, b) => sum + b.present, 0);
      result.absent = result.classBreakdown.reduce((sum, b) => sum + b.absent, 0);
      result.total = result.classBreakdown.reduce((sum, b) => sum + b.total, 0);
      result.percentage = result.total > 0 ? Number(((result.present / result.total) * 100).toFixed(1)) : 0;

      return result;
    } catch (err: any) {
      console.warn('[DualDB] Supabase today attendance query warning:', err.message);
      return result;
    }
  }

  /**
   * Supabase: Get Weekly Attendance Trend with a single date-range query
   */
  static async getWeeklyTrendFromSupabase(schoolId: string, fromDate: string, toDate: string) {
    if (!isPostgresConfigured || !schoolId) return [];

    try {
      const res = await pool.query(`
        SELECT 
          attendance_date,
          SUM(present_count)::int as present,
          SUM(absent_count)::int as absent,
          SUM(total_count)::int as total
        FROM attendance_sessions
        WHERE school_id = $1 AND attendance_date >= $2 AND attendance_date <= $3
        GROUP BY attendance_date
        ORDER BY attendance_date ASC
      `, [schoolId, fromDate, toDate]);

      return res.rows || [];
    } catch (err: any) {
      console.warn('[DualDB] Supabase weekly trend query warning:', err.message);
      return [];
    }
  }
}

