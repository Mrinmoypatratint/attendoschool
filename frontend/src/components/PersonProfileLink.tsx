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
  children?: React.ReactNode;
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
      params: { includeInactive: 'true', limit: kind === 'student' ? 1000 : 500 }
    })
    .then(({ data }) => {
      const rows = Array.isArray(data) ? data : data?.data || [];
      rows.forEach((row: Record<string, unknown>) => {
        if (row.id) cache[kind].set(`id:${row.id}`, row);
        if (row.user_id) cache[kind].set(`id:${row.user_id}`, row);
        if (row.name) cache[kind].set(`name:${normalise(row.name)}`, row);
      });
      loaded.add(kind);
    })
    .finally(() => pending.delete(kind));
  pending.set(kind, request);
  return request;
}

/** Clickable student/teacher name for staff-only screens. Full profile data is
 * resolved lazily from the tenant-scoped people API and cached for the session. */
export function PersonProfileLink({ kind, id, name, person, children }: PersonProfileLinkProps) {
  const { user } = useAuth();
  const [resolved, setResolved] = useState<Record<string, unknown>>(() => ({
    ...(person || {}), id: id || person?.id, name
  }));
  const allowed = user?.role === 'SCHOOL_ADMIN' || user?.role === 'TEACHER' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    loadDirectory(kind).then(() => {
      if (!active) return;
      const full = (id && cache[kind].get(`id:${id}`)) || cache[kind].get(`name:${normalise(name)}`);
      if (full) setResolved({ ...(person || {}), ...full, id: full.id || id, name: full.name || name });
    }).catch(() => { /* The supplied summary still provides a useful profile. */ });
    return () => { active = false; };
  }, [allowed, id, kind, name, person]);

  const label = children || name;
  if (!allowed || !name) return <>{label}</>;
  if (kind === 'student') {
    return <StudentProfileHoverCard student={resolved as unknown as StudentHoverData}>{label}</StudentProfileHoverCard>;
  }
  return <TeacherProfileHoverCard teacher={resolved as unknown as TeacherHoverData}>{label}</TeacherProfileHoverCard>;
}

export default PersonProfileLink;
