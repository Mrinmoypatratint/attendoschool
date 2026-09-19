import React,{useEffect,useState} from 'react';
import {api} from '../../api';

export default function ParentCommunication(){
 const [items,setItems]=useState<any[]>([]),[msg,setMsg]=useState('');
 async function load(){try{setItems((await api.get('/communication/parent/inbox')).data)}catch(e:any){setMsg(e?.response?.data?.message||'Unable to load messages')}}
 async function read(id:string){try{await api.post(`/communication/parent/read/${id}`);load()}catch(e:any){setMsg(e?.response?.data?.message||'Unable to mark read')}}
 useEffect(()=>{load()},[]);

 return <div className="feature-page">
  <h1>Parent Messages</h1>
  <p className="muted">Direct announcements from school administration and teachers.</p>
  {msg&&<div className="error">{msg}</div>}

  <div style={{display:'grid',gap:12}}>
   {items.map(x=><article key={x.recipient_id} className="panel">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
     <h3 style={{margin:0}}>{x.title}</h3>
     <span className={`badge ${x.priority==='EMERGENCY'?'failed':x.priority==='HIGH'?'queued':'active'}`}>{x.priority}</span>
    </div>
    <p style={{margin:'8px 0',lineHeight:1.6}}>{x.message}</p>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
     <small className="muted">{x.published_at?new Date(x.published_at).toLocaleString():''}</small>
     {!x.read_at&&<button className="small-btn" onClick={()=>read(x.recipient_id)}>Mark as read</button>}
    </div>
   </article>)}
  </div>

  {!items.length&&!msg&&<div className="panel"><p className="muted">No messages received yet.</p></div>}
 </div>
}
