import React,{useEffect,useState} from 'react';
import {api} from './api';

export default function BackupV21(){
 const [jobs,setJobs]=useState<any[]>([]),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{setJobs((await api.get('/backups-v21/jobs')).data)}catch(e:any){setMsg(e?.response?.data?.message||'Unable to load backups')}}
 async function create(){
  setBusy(true);setMsg('Creating database backup…');
  try{await api.post('/backups-v21/create');setMsg('Backup completed successfully.');load()}
  catch(e:any){setMsg(e?.response?.data?.message||'Backup failed')}
  finally{setBusy(false)}
 }
 useEffect(()=>{load()},[]);

 return <div className="feature-page">
  <div className="feature-header">
   <div>
    <h1>Backup & Disaster Recovery</h1>
    <p className="muted">Database backups, checksum tracking and restore-test records.</p>
   </div>
   <button onClick={create} disabled={busy}>{busy?'Creating…':'Create Backup Now'}</button>
  </div>

  {msg&&<div className={msg.includes('failed')?'error':'success'}>{msg}</div>}

  <div className="table-wrap">
   <table>
    <thead><tr><th>Status</th><th>Started</th><th>File</th><th>Size</th><th>SHA-256</th></tr></thead>
    <tbody>{jobs.map(j=><tr key={j.id}>
      <td><span className={`badge ${j.status==='COMPLETED'?'active':'queued'}`}>{j.status}</span></td>
      <td>{new Date(j.started_at).toLocaleString()}</td>
      <td>{j.file_name||'—'}</td>
      <td>{j.size_bytes?`${Math.round(j.size_bytes/1024)} KB`:'—'}</td>
      <td><code style={{fontSize:11}}>{j.checksum_sha256 ? j.checksum_sha256.slice(0,16)+'…' : '—'}</code></td>
    </tr>)}{!jobs.length&&<tr><td colSpan={5} className="muted" style={{padding:20}}>No backup jobs recorded yet.</td></tr>}</tbody>
   </table>
  </div>
 </div>
}
