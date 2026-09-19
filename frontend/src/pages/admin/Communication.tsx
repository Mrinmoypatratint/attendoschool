import React,{useEffect,useState} from 'react';
import {api} from '../../api';

export default function Communication(){
 const [items,setItems]=useState<any[]>([]);
 const [form,setForm]=useState({title:'',message:'',audienceType:'SCHOOL',priority:'NORMAL'});
 const [msg,setMsg]=useState('');

 async function load(){try{setItems((await api.get('/communication/announcements')).data)}catch(e:any){setMsg(e?.response?.data?.message||'Unable to load announcements')}}
 async function create(){try{await api.post('/communication/announcements',form);setMsg('Announcement saved');setForm({...form,title:'',message:''});load()}catch(e:any){setMsg(e?.response?.data?.message||'Unable to save')}}
 async function publish(id:string){try{await api.post(`/communication/announcements/${id}/publish`);setMsg('Published and recipients prepared');load()}catch(e:any){setMsg(e?.response?.data?.message||'Unable to publish')}}
 useEffect(()=>{load()},[]);

 return <div className="feature-page">
  <h1>School–Parent Communication</h1>
  <p className="muted">Create and publish announcements to parents, classes, or the entire school.</p>

  <div className="form-card">
   <h3>New Announcement</h3>
   <div style={{display:'grid',gap:10}}>
    <input placeholder="Announcement title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
    <textarea placeholder="Message" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} style={{minHeight:100}}/>
    <div className="form-inline">
     <select value={form.audienceType} onChange={e=>setForm({...form,audienceType:e.target.value})}>
      <option>SCHOOL</option><option>CLASS</option><option>SECTION</option><option>PARENTS</option>
     </select>
     <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
      <option>NORMAL</option><option>HIGH</option><option>EMERGENCY</option>
     </select>
     <button onClick={create}>Save</button>
    </div>
   </div>
  </div>

  {msg&&<div className="success">{msg}</div>}

  <div className="table-wrap">
   <table>
    <thead><tr><th>Title</th><th>Audience</th><th>Priority</th><th>Status</th><th>Recipients</th><th>Read</th><th></th></tr></thead>
    <tbody>{items.map(x=><tr key={x.id}>
     <td><b>{x.title}</b></td>
     <td><span className="badge">{x.audience_type}</span></td>
     <td><span className={`badge ${x.priority==='EMERGENCY'?'failed':x.priority==='HIGH'?'queued':''}`}>{x.priority}</span></td>
     <td><span className={`badge ${x.status==='PUBLISHED'?'sent':'queued'}`}>{x.status}</span></td>
     <td>{x.recipient_count}</td>
     <td>{x.read_count}</td>
     <td>{x.status!=='PUBLISHED'&&<button className="small-btn" onClick={()=>publish(x.id)}>Publish</button>}</td>
    </tr>)}</tbody>
   </table>
  </div>
 </div>
}
