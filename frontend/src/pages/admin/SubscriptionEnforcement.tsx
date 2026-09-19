import React,{useEffect,useState} from 'react';
import {api} from '../../api';

export default function SubscriptionEnforcement(){
 const [data,setData]=useState<any>(null),[msg,setMsg]=useState('');
 async function load(){try{const r=await api.get('/subscriptions/status');setData(r.data)}catch(e:any){setMsg(e?.response?.data?.message||'Unable to load subscription')}}
 useEffect(()=>{load()},[]);

 if(msg)return <div className="feature-page"><h1>Subscription Status</h1><div className="error">{msg}</div></div>;
 if(!data)return <div className="feature-page"><p className="muted">Loading subscription status…</p></div>;

 return <div className="feature-page">
  <h1>Subscription Enforcement</h1>
  <p className="muted">Plan enforcement, student/teacher tier limits, and automated grace periods.</p>

  <div className="summary-grid">
   <div className="summary-card"><b>Plan</b><div>{data.plan_name||'—'}</div></div>
   <div className="summary-card"><b>Status</b><div><span className={`badge ${data.effective_status==='ACTIVE'?'active':data.effective_status==='GRACE'?'queued':'expired'}`}>{data.effective_status}</span></div></div>
   <div className="summary-card"><b>Expiry</b><div>{data.end_date?new Date(data.end_date).toLocaleDateString():'—'}</div></div>
   <div className="summary-card"><b>Students</b><div>{data.student_count}{data.max_students?` / ${data.max_students}`:''}</div></div>
   <div className="summary-card"><b>Teachers</b><div>{data.teacher_count}{data.max_teachers?` / ${data.max_teachers}`:''}</div></div>
   <div className="summary-card"><b>Grace Period</b><div>{data.effective_grace_days} days</div></div>
  </div>

  {data.effective_status!=='ACTIVE'&&<div className="panel" style={{marginTop:16,borderLeft:'4px solid var(--amber-500)'}}>
   <h3>Notice</h3>
   <p className="muted" style={{margin:0}}>
    {data.effective_status==='GRACE'?'Your subscription is currently in the grace period. Please renew soon to avoid service interruption.':'Your subscription has expired. Attendance operations are restricted until renewed.'}
   </p>
  </div>}
 </div>
}
