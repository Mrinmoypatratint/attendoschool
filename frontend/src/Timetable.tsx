import React,{useEffect,useState} from 'react';
import {api} from './api';

export default function TimetableV22(){
 const [periods,setPeriods]=useState<any[]>([]);
 const [entries,setEntries]=useState<any[]>([]);
 const [msg,setMsg]=useState('');
 const [form,setForm]=useState({name:'Period',periodNumber:1,startTime:'09:00',endTime:'09:45',isBreak:false});

 async function load(){
  try{
   const [p,e]=await Promise.all([api.get('/timetable-v22/periods'),api.get('/timetable-v22/entries')]);
   setPeriods(p.data);setEntries(e.data);
  }catch(e:any){setMsg(e?.response?.data?.message||'Unable to load timetable')}
 }
 async function addPeriod(){
  try{await api.post('/timetable-v22/periods',form);setMsg('Period created');load()}
  catch(e:any){setMsg(e?.response?.data?.message||'Unable to create period')}
 }
 useEffect(()=>{load()},[]);

 return <div className="feature-page">
  <h1>Advanced Timetable</h1>
  <p className="muted">Weekly timetable with period management, teacher/class/room conflict detection and substitute support.</p>

  <div className="form-card">
   <h3>Add Period</h3>
   <div className="form-inline">
    <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Name"/>
    <input type="number" value={form.periodNumber} onChange={e=>setForm({...form,periodNumber:+e.target.value})} style={{maxWidth:80}}/>
    <input type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/>
    <input type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/>
    <button onClick={addPeriod}>Add</button>
   </div>
  </div>

  {msg&&<div className="success">{msg}</div>}

  <div className="panel">
   <h3>Periods</h3>
   <div className="list">
    {periods.map(p=><div className="list-row" key={p.id}>
     <b>{p.period_number}. {p.name}</b>
     <span>{p.start_time}–{p.end_time}{p.is_break?' (Break)':''}</span>
    </div>)}
    {!periods.length&&<p className="muted" style={{padding:'12px 0'}}>No periods defined yet.</p>}
   </div>
  </div>

  <div className="panel" style={{marginTop:16}}>
   <h3>Published/Draft Entries</h3>
   <div className="table-wrap">
    <table>
     <thead><tr><th>Day</th><th>Period</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Status</th></tr></thead>
     <tbody>{entries.map(e=><tr key={e.id}>
      <td>{['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][e.day_of_week]}</td>
      <td>{e.period_name}</td>
      <td>{e.subject_name||'—'}</td>
      <td>{e.substitute_teacher_name||e.teacher_name||'—'}</td>
      <td>{e.room_name||'—'}</td>
      <td><span className={`badge ${e.status==='PUBLISHED'?'sent':'queued'}`}>{e.status}</span></td>
     </tr>)}{!entries.length&&<tr><td colSpan={6} className="muted" style={{padding:20}}>No entries yet.</td></tr>}</tbody>
    </table>
   </div>
  </div>
 </div>
}
