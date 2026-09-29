import { pool, isPostgresConfigured } from '../db';
import { env } from '../config/env';

/**
 * Dual Database Synchronization & Quota Failover Service
 * 
 * Architecture:
 * - PRIMARY: Firebase Cloud Firestore (Real-time updates, standard read/write)
 * - SECONDARY: Supabase / PostgreSQL (Automated continuous mirror, unlimited reads/writes, failover engine)
 * 
 * When Firebase Cloud Firestore encounters daily quota limits (RESOURCE_EXHAUSTED / 50k reads),
 * the failover methods execute queries against Supabase PostgreSQL so the school platform stays 100% online.
 */

export class DualDatabaseService {
  /**
   * Check if Supabase / PostgreSQL secondary store is active
   */
  static isSecondaryAvailable(): boolean {
    return isPostgresConfigured && env.enableDualDbSync;
  }

  /**
   * Safe execution wrapper: Tries Primary (Firebase), falls back to Secondary (Supabase) on quota error
   */
  static async executeWithFailover<T>(
    primaryFn: () => Promise<T>,
    secondaryFn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await primaryFn();
    } catch (primaryErr: any) {
      const isQuotaError = primaryErr?.message && (
        primaryErr.message.includes('Quota exceeded') ||
        primaryErr.message.includes('RESOURCE_EXHAUSTED') ||
        primaryErr.code === 8
      );

      if (isQuotaError && this.isSecondaryAvailable()) {
        console.warn(`[DualDB Failover] Primary Firebase quota exceeded during "${operationName}". Seamlessly falling back to Supabase PostgreSQL...`);
        try {
          return await secondaryFn();
        } catch (secondaryErr: any) {
          console.error(`[DualDB Failover] Secondary Supabase execution failed for "${operationName}":`, secondaryErr.message);
          throw primaryErr; // Re-throw primary if secondary also fails
        }
      }

      throw primaryErr;
    }
  }

  /**
   * Mirror student record to Supabase
   */
  static async syncStudentToSupabase(student: any): Promise<boolean> {
    if (!this.isSecondaryAvailable()) return false;
    try {
      const query = `
        INSERT INTO students (id, school_id, class_id, section_id, roll_number, admission_number, name, parent_name, parent_sms_number, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          roll_number = EXCLUDED.roll_number,
          admission_number = EXCLUDED.admission_number,
          name = EXCLUDED.name,
          parent_name = EXCLUDED.parent_name,
          parent_sms_number = EXCLUDED.parent_sms_number,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `;
      const id = student.id || student._id;
      const schoolId = student.school_id || student.schoolId;
      if (!id || !schoolId) return false;

      await pool.query(query, [
        id,
        schoolId,
        student.class_id || student.classId || null,
        student.section_id || student.sectionId || null,
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
    if (!this.isSecondaryAvailable()) return false;
    try {
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
        session.id,
        session.school_id || session.schoolId,
        session.class_id || session.classId,
        session.section_id || session.sectionId,
        session.subject_id || session.subjectId || null,
        session.teacher_id || session.teacherId,
        session.attendance_date || session.attendanceDate,
        session.start_time || '09:00:00',
        session.end_time || '10:00:00',
        session.class_number || session.classNumber || 10,
        session.section_name || session.sectionName || 'A',
        session.present_count || 0,
        session.absent_count || 0,
        session.total_count || 0
      ]);

      if (records && records.length > 0) {
        for (const r of records) {
          await pool.query(`
            INSERT INTO attendance_records (id, attendance_session_id, student_id, is_present, status, remarks, marked_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (attendance_session_id, student_id) DO UPDATE SET
              is_present = EXCLUDED.is_present,
              status = EXCLUDED.status,
              remarks = EXCLUDED.remarks,
              marked_at = NOW();
          `, [
            r.id || `${session.id}_${r.student_id || r.studentId}`,
            session.id,
            r.student_id || r.studentId,
            r.is_present ?? (r.status === 'PRESENT'),
            r.status || (r.is_present ? 'PRESENT' : 'ABSENT'),
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
   * Supabase Fallback: Get Student Count
   */
  static async getStudentCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured) return 0;
    try {
      const res = await pool.query(
        'SELECT COUNT(*)::int as count FROM students WHERE school_id = $1 AND is_active = true',
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn('[DualDB Fallback] Supabase student count failed:', err.message);
      return 0;
    }
  }

  /**
   * Supabase Fallback: Get Teacher Count
   */
  static async getTeacherCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured) return 0;
    try {
      const res = await pool.query(
        "SELECT COUNT(*)::int as count FROM users WHERE school_id = $1 AND role = 'TEACHER' AND is_active = true",
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn('[DualDB Fallback] Supabase teacher count failed:', err.message);
      return 0;
    }
  }

  /**
   * Supabase Fallback: Get Class Count
   */
  static async getClassCountFromSupabase(schoolId: string): Promise<number> {
    if (!isPostgresConfigured) return 0;
    try {
      const res = await pool.query(
        'SELECT COUNT(*)::int as count FROM classes WHERE school_id = $1',
        [schoolId]
      );
      return res.rows[0]?.count || 0;
    } catch (err: any) {
      console.warn('[DualDB Fallback] Supabase class count failed:', err.message);
      return 0;
    }
  }

  /**
   * Supabase Fallback: Get Today's Attendance Breakdown
   */
  static async getTodayAttendanceFromSupabase(schoolId: string, dateStr: string) {
    const result = {
      total: 0,
      present: 0,
      absent: 0,
      percentage: 0,
      classBreakdown: [] as any[]
    };
    if (!isPostgresConfigured) return result;

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
      console.warn('[DualDB Fallback] Supabase today attendance query failed:', err.message);
      return result;
    }
  }
}
