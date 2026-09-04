const KEY='attendance-offline-queue-v23';

export type OfflineRecord={clientRecordId:string,studentId:string,attendanceDate:string,present:boolean};
export type OfflineBatch={batchId:string,deviceId:string,records:OfflineRecord[]};

export function getQueue():OfflineBatch[]{
 try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}
}
export function queueAttendance(batch:OfflineBatch){
 const q=getQueue().filter(x=>x.batchId!==batch.batchId);q.push(batch);localStorage.setItem(KEY,JSON.stringify(q));return q.length;
}
export function removeBatch(batchId:string){
 const q=getQueue().filter(x=>x.batchId!==batchId);localStorage.setItem(KEY,JSON.stringify(q));
}
export async function syncOffline(api:any){
 if(!navigator.onLine)return {synced:0,offline:true};
 let synced=0;
 for(const batch of getQueue()){
  try{
   const r=await api.post('/offline-attendance-v23/sync',batch);
   await api.post(`/offline-attendance-v23/sync/${r.data.id}/process`);
   removeBatch(batch.batchId);synced++;
  }catch{}
 }
 return {synced,offline:false};
}
export function makeBatch(records:OfflineRecord[]):OfflineBatch{
 const deviceId=localStorage.getItem('attendance-device-id-v23')||crypto.randomUUID();
 localStorage.setItem('attendance-device-id-v23',deviceId);
 return {batchId:crypto.randomUUID(),deviceId,records};
}
