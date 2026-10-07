const KEY = 'attendance-offline-queue';

export type OfflineRecord = { clientRecordId: string; studentId: string; attendanceDate: string; present: boolean };
export type OfflineBatch = { batchId: string; deviceId: string; records: OfflineRecord[] };

export function getQueue(): OfflineBatch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function queueAttendance(batch: OfflineBatch) {
  const q = getQueue().filter((x) => x.batchId !== batch.batchId);
  q.push(batch);
  localStorage.setItem(KEY, JSON.stringify(q));
  return q.length;
}

export function removeBatch(batchId: string) {
  const q = getQueue().filter((x) => x.batchId !== batchId);
  localStorage.setItem(KEY, JSON.stringify(q));
}

export async function syncOffline(api: any) {
  if (!navigator.onLine) return { synced: 0, offline: true };
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, offline: false };

  const results = await Promise.allSettled(
    queue.map(async (batch) => {
      const r = await api.post('/offline-attendance/sync', batch);
      await api.post(`/offline-attendance/sync/${r.data.id}/process`);
      removeBatch(batch.batchId);
      return batch.batchId;
    })
  );

  const synced = results.filter((r) => r.status === 'fulfilled').length;
  return { synced, offline: false };
}

export function makeBatch(records: OfflineRecord[]): OfflineBatch {
  const deviceId = localStorage.getItem('attendance-device-id') || crypto.randomUUID();
  localStorage.setItem('attendance-device-id', deviceId);
  return { batchId: crypto.randomUUID(), deviceId, records };
}
