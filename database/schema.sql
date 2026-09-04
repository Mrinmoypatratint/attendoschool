CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER');
CREATE TYPE school_status AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED');

CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255),
    phone VARCHAR(30),
    enquiry_number VARCHAR(30),
    address TEXT,
    status school_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT school_required_for_non_super_admin CHECK (role = 'SUPER_ADMIN' OR school_id IS NOT NULL)
);

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_number SMALLINT NOT NULL CHECK (class_number BETWEEN 5 AND 12),
    UNIQUE(school_id, class_number)
);

CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(30) NOT NULL,
    UNIQUE(class_id, name)
);

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    UNIQUE(school_id, name)
);

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id),
    section_id UUID NOT NULL REFERENCES sections(id),
    roll_number VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    parent_name VARCHAR(150),
    parent_sms_number VARCHAR(30) NOT NULL,
    photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(class_id, section_id, roll_number)
);

CREATE TABLE teacher_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    mobile VARCHAR(30)
);

CREATE TABLE class_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id),
    section_id UUID NOT NULL REFERENCES sections(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    teacher_id UUID NOT NULL REFERENCES users(id),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(50),
    CHECK (end_time > start_time)
);

CREATE TABLE attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id),
    section_id UUID NOT NULL REFERENCES sections(id),
    subject_id UUID REFERENCES subjects(id),
    teacher_id UUID NOT NULL REFERENCES users(id),
    attendance_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id),
    is_present BOOLEAN NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(attendance_session_id, student_id)
);

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    max_students INTEGER,
    price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
    price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE school_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES school_subscriptions(id),
    provider VARCHAR(50),
    provider_order_id VARCHAR(150),
    provider_payment_id VARCHAR(150),
    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE TABLE sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id),
    parent_number VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    provider_message_id VARCHAR(150),
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class_section ON students(class_id, section_id);
CREATE INDEX idx_routines_school ON class_routines(school_id);
CREATE INDEX idx_attendance_school_date ON attendance_sessions(school_id, attendance_date);
CREATE INDEX idx_sms_school ON sms_logs(school_id);
CREATE INDEX idx_payments_school ON payments(school_id);
