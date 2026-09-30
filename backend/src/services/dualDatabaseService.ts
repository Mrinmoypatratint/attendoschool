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
    operationName: string
  ): Promise<T> {
    if (this.isPrimaryAvailable()) {
      try {
        return await secondaryFn(); // Run Supabase function as primary
      } catch (pgErr: any) {
        console.warn(`[DualDB] Supabase primary query warning for "${operationName}":`, pgErr.message);
        try {
          return await primaryFn(); // Fall back to secondary
        } catch (secErr: any) {
          throw pgErr;
        }
      }
    }

    // Supabase not configured: run Firebase directly
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
        for (const r of records) {
          const rawStudentId = r.student_id || r.studentId;
          if (!rawStudentId) continue;

          let studentId = rawStudentId;
          if (!isUuid(studentId)) {
            // Find student by roll number or name in postgres
            const stRes = await pool.query(
              'SELECT id FROM students WHERE school_id = $1 AND (roll_number = $2 OR name = $3) LIMIT 1',
              [schoolId, String(r.rollNumber || r.roll_number || rawStudentId), String(r.studentName || r.name || '')]
            );
            if (stRes.rowCount) {
              studentId = stRes.rows[0].id;
            } else {
              // Ensure student exists in students table
              const newUuid = crypto.randomUUID();
              await pool.query(`
                INSERT INTO students (id, school_id, class_id, section_id, roll_number, name, parent_sms_number, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                ON CONFLICT (id) DO NOTHING
              `, [newUuid, schoolId, classId, sectionId, String(r.rollNumber || r.roll_number || '1'), String(r.studentName || r.name || 'Student'), '+919876543210']);
              studentId = newUuid;
            }
          }

          const isPres = r.is_present ?? (r.status === 'PRESENT' || r.status === 'LATE');
          const status = r.status || (isPres ? 'PRESENT' : 'ABSENT');

          await pool.query(`
            INSERT INTO attendance_records (
              id, attendance_session_id, student_id, is_present, status, remarks, marked_at
            ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
            ON CONFLICT (attendance_session_id, student_id) DO UPDATE SET
              is_present = EXCLUDED.is_present,
              status = EXCLUDED.status,
              remarks = EXCLUDED.remarks,
              marked_at = NOW();
          `, [
            sessionId,
            studentId,
            isPres,
            status,
            r.remarks || ''
          ]);
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
}
