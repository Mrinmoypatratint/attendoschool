import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { StudentProfileHoverCard, StudentHoverData } from './StudentProfileHoverCard';
import { TeacherProfileHoverCard, TeacherHoverData } from './TeacherProfileHoverCard';

type PersonKind = 'student' | 'teacher';

type PersonProfileLinkProps = {
  kind: PersonKind;
  id?: string | null;
  name: string;
  person?: Record<string, unknown>;
  activeSession?: string;
  children?: React.ReactNode;
  mode?: 'student' | 'report';
};

const cache: Record<PersonKind, Map<string, Record<string, unknown>>> = {
  student: new Map(),
  teacher: new Map()
};
const loaded = new Set<PersonKind>();
const pending = new Map<PersonKind, Promise<void>>();

const normalise = (value: unknown) => String(value || '').trim().toLowerCase();

async function loadDirectory(kind: PersonKind) {
  if (loaded.has(kind)) return;
  const existing = pending.get(kind);
  if (existing) return existing;

  const request = api
    .get(`/people/${kind === 'student' ? 'students' : 'teachers'}`, {
      params: { includeInactive: 'true', limit: kind === 'student' ? 5000 : 1000 }
    })
    .then(({ data }) => {
      const rows = Array.isArray(data) ? data : data?.data || [];
      rows.forEach((row: Record<string, unknown>) => {
        if (row.id) cache[kind].set(`id:${row.id}`, row);
        if (row.user_id) cache[kind].set(`id:${row.user_id}`, row);
        if (row.name) {
          cache[kind].set(`name:${normalise(row.name)}`, row);
          const roll = row.roll_number ?? (row as any).roll ?? (row as any).rollNo;
          if (roll) {
            cache[kind].set(`nameroll:${normalise(row.name)}:${normalise(roll)}`, row);
          }
        }
      });
      loaded.add(kind);
    })
    .finally(() => pending.delete(kind));
  pending.set(kind, request);
  return request;
}

/** Clickable student/teacher name for staff-only screens. Full profile data is
 * resolved lazily from the tenant-scoped people API and cached for the session. */
export function PersonProfileLink({ kind, id, name, person, activeSession, children, mode }: PersonProfileLinkProps) {
  const { user } = useAuth();
  const effectiveId = id || (person?.id as string) || ((person as any)?.student_id as string) || ((person as any)?.studentId as string) || ((person as any)?.teacher_id as string) || ((person as any)?.teacherId as string);
  const personRoll = person?.roll_number ?? (person as any)?.roll ?? (person as any)?.rollNo;

  const [resolved, setResolved] = useState<Record<string, unknown>>(() => ({
    ...(person || {}),
    id: effectiveId,
    name,
    roll_number: personRoll ?? (person as any)?.roll_number,
    roll: personRoll ?? (person as any)?.roll
  }));
  const allowed = user?.role === 'SCHOOL_ADMIN' || user?.role === 'TEACHER' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!allowed) return;
    let active = true;

    const findMatch = () => {
      return (effectiveId && cache[kind].get(`id:${effectiveId}`)) ||
        (personRoll && cache[kind].get(`nameroll:${normalise(name)}:${normalise(personRoll)}`)) ||
        cache[kind].get(`name:${normalise(name)}`);
    };

    const cached = findMatch();
    if (cached) {
      setResolved({
        ...(person || {}),
        ...cached,
        id: cached.id || effectiveId,
        name: cached.name || name
      });
      return;
    }

    loadDirectory(kind).then(() => {
      if (!active) return;
      const full = findMatch();
      if (full) {
        setResolved({
          ...(person || {}),
          ...full,
          id: full.id || effectiveId,
          name: full.name || name
        });
      } else if (effectiveId && kind === 'student') {
        // Individual fallback fetch
        api.get(`/people/students/${effectiveId}`).then(({ data }) => {
          if (!active || !data) return;
          if (data.id) cache.student.set(`id:${data.id}`, data);
          if (data.name) cache.student.set(`name:${normalise(data.name)}`, data);
          setResolved(prev => ({ ...(person || {}), ...data }));
        }).catch(() => {});
      }
    }).catch(() => {
      if (effectiveId && kind === 'student') {
        api.get(`/people/students/${effectiveId}`).then(({ data }) => {
          if (!active || !data) return;
          setResolved(prev => ({ ...(person || {}), ...data }));
        }).catch(() => {});
      }
    });

    return () => { active = false; };
  }, [allowed, effectiveId, kind, name, person, personRoll]);

  const label = children || name;
  if (!allowed || !name) return <>{label}</>;
  if (kind === 'student') {
    return (
      <StudentProfileHoverCard 
        student={resolved as unknown as StudentHoverData}
        activeSession={activeSession || (resolved as any).session_name || (resolved as any).session || (person as any)?.session}
        mode={mode}
      >
        {label}
      </StudentProfileHoverCard>
    );
  }
  return <TeacherProfileHoverCard teacher={resolved as unknown as TeacherHoverData}>{label}</TeacherProfileHoverCard>;
}

export default PersonProfileLink;
