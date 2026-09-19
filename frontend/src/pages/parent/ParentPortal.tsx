import React,{useEffect,useState} from 'react';
import {api} from '../../api';

export default function ParentPortal(){
 const [children,setChildren]=useState<any[]>([]);
 const [selected,setSelected]=useState<any>(null);
 const [data,setData]=useState<any>(null);
 const [message,setMessage]=useState('');
 const [from,setFrom]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10));
 const [to,setTo]=useState(new Date().toISOString().slice(0,10));

 async function loadChildren(){
  try{const r=await api.get('/parent-portal/children');setChildren(r.data);if(r.data[0])setSelected(r.data[0]);}
  catch(e:any){setMessage(e?.response?.data?.message||'Unable to load children');}
 }
 async function loadAttendance(){
  if(!selected)return;
  try{const r=await api.get(`/parent-portal/children/${selected.id}/attendance`,{params:{from,to}});setData(r.data);}
  catch(e:any){setMessage(e?.response?.data?.message||'Unable to load attendance');}
 }
 useEffect(()=>{loadChildren()},[]);
 useEffect(()=>{loadAttendance()},[selected,from,to]);

 return <div className="feature-page">
  <h1>Parent Portal</h1>
  <p className="muted">View your linked child's attendance and attendance percentage.</p>
  {message&&<div className="error">{message}</div>}
  <div className="action-row" style={{marginBottom:18}}>
   {children.map(c=><button key={c.id} className={selected?.id===c.id?'':'secondary'} onClick={()=>setSelected(c)}>{c.name} · {c.class_name||''}</button>)}
  </div>
  {selected&&<div>
   <div className="panel">
    <h3>{selected.name}</h3>
    <p className="muted">Class {selected.class_name||'-'} / {selected.section_name||'-'} · Roll {selected.roll}</p>
    <div className="filter-row">
     <label>From <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
     <label>To <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    </div>
   </div>
   {data&&<div className="summary-grid" style={{marginTop:16}}>
    <div className="summary-card"><b>Present</b><div>{data.summary.present}</div></div>
    <div className="summary-card"><b>Absent</b><div>{data.summary.absent}</div></div>
    <div className="summary-card"><b>Marked</b><div>{data.summary.marked}</div></div>
    <div className="summary-card"><b>Attendance</b><div>{data.summary.percentage}%</div></div>
   </div>}
   <div className="table-wrap" style={{marginTop:16}}>
    <table>
     <thead><tr><th>Date</th><th>Time</th><th>Teacher</th><th>Status</th></tr></thead>
     <tbody>{(data?.records||[]).map((r:any,i:number)=><tr key={i}>
       <td>{String(r.attendance_date).slice(0,10)}</td>
       <td>{r.start_time||'-'}{r.end_time?` - ${r.end_time}`:''}</td>
       <td>{r.teacher_name||'-'}</td>
       <td><span className={`badge ${r.status==='PRESENT'?'sent':'failed'}`}>{r.status}</span></td>
     </tr>)}</tbody>
    </table>
   </div>
  </div>}
  {!children.length&&<div className="panel"><p className="muted">No student is linked to this parent account yet.</p></div>}
 </div>
}
