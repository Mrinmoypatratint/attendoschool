import React,{useEffect,useState} from 'react';
import {api} from '../../api';
import {getQueue,syncOffline} from '../../services/offlineAttendanceQueue';

export default function OfflineAttendance(){
 const [online,setOnline]=useState(navigator.onLine),[queued,setQueued]=useState(getQueue().length),[msg,setMsg]=useState(''),[syncing,setSyncing]=useState(false);
 useEffect(()=>{
  const on=()=>{setOnline(true);syncOffline(api).then(r=>{setQueued(getQueue().length);if(r.synced)setMsg(`${r.synced} offline batch(es) synchronized.`)})};
  const off=()=>setOnline(false);
  window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}
 },[]);

 async function sync(){
  setSyncing(true);
  try {
   const r=await syncOffline(api);
   setQueued(getQueue().length);
   setMsg(r.offline?'You are offline.':'Synchronization completed.');
  } finally { setSyncing(false); }
 }

 return <div className="feature-page">
  <h1>Offline Attendance</h1>
  <p className="muted">Record attendance without internet. Records queue locally in IndexedDB/localStorage and sync automatically when connection restores.</p>

  <div className="summary-grid">
   <div className="summary-card">
    <b>Connection Status</b>
    <div><span className={`badge ${online?'active':'expired'}`}>{online?'Online':'Offline'}</span></div>
   </div>
   <div className="summary-card">
    <b>Queued Batches</b>
    <div>{queued}</div>
   </div>
  </div>

  <div className="panel" style={{marginTop:16}}>
   <h3>Manual Synchronization</h3>
   <p className="muted">Click below to push pending offline attendance records to the server.</p>
   <button onClick={sync} disabled={!online || syncing}>{syncing?'Syncing…':'Synchronize Now'}</button>
   {msg&&<div className="success" style={{marginTop:12}}>{msg}</div>}
  </div>
 </div>
}
