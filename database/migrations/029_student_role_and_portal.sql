-- V29: Student Role, Authentication & Student Portal Schema
-- Safe, idempotent migration to enable student authentication, assignments, exams, and leave requests.

-- 1. Extend user_role ENUM safely in PostgreSQL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'STUDENT') THEN
            ALTER TYPE user_role ADD VALUE 'STUDENT';
        END IF;
    END IF;
END $$;

-- Update check constraint on users.role if present
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role::text IN ('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER','PARENT','STUDENT'));

-- 2. Add student authentication & profile link columns to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_school_user ON students(school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users(school_id, role);

-- 3. Student Homework / Assignments
CREATE TABLE IF NOT EXISTS student_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    max_marks NUMERIC(5,2) DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Student Assignment Submissions
CREATE TABLE IF NOT EXISTS student_assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES student_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'GRADED', 'OVERDUE')),
    submitted_at TIMESTAMPTZ,
    submission_text TEXT,
    marks_obtained NUMERIC(5,2),
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

-- 5. Student Examinations & Timetable
CREATE TABLE IF NOT EXISTS student_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(50),
    total_marks NUMERIC(5,2) NOT NULL DEFAULT 100,
    passing_marks NUMERIC(5,2) NOT NULL DEFAULT 35,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Student Exam Results
CREATE TABLE IF NOT EXISTS student_exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES student_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(5,2) NOT NULL,
    grade VARCHAR(10),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exam_id, student_id)
);

-- 7. Student Leave Requests
CREATE TABLE IF NOT EXISTS student_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_school_class ON student_assignments(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON student_assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_school_class ON student_exams(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON student_exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON student_leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_school ON student_leave_requests(school_id);
