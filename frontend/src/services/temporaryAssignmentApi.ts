import { api } from '../api';

/** List temporary assignments for the current admin's school */
export const listAssignments = (params?: {
  classId?: string;
  sectionId?: string;
  teacherId?: string;
  status?: 'active' | 'future' | 'past';
}) => {
  const q: any = {};
  if (params?.classId) q.class_id = params.classId;
  if (params?.sectionId) q.section_id = params.sectionId;
  if (params?.teacherId) q.teacher_id = params.teacherId;
  if (params?.status) q.status = params.status;
  return api.get('/admin/temporary-assignments', { params: q });
};

/** Create a new temporary assignment */
export const createAssignment = (payload: {
  teacherId: string;
  classId: string;
  sectionId: string;
  startAt: string; // ISO datetime string
  endAt: string;
}) => {
  return api.post('/admin/temporary-assignments', {
    teacherId: payload.teacherId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    startAt: payload.startAt,
    endAt: payload.endAt,
  });
};

/** End an active temporary assignment early */
export const endAssignment = (assignmentId: string) => {
  return api.post(`/admin/temporary-assignments/${assignmentId}/end`);
};
