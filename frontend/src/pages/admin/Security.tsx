import React,{useState} from 'react';
import {api} from '../../api';

export default function Security(){
 const [password,setPassword]=useState(''),[result,setResult]=useState<any>(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 async function check(){
  setBusy(true);
  try{const r=await api.post('/security/validate-password',{password});setResult(r.data);setMsg('')}
  catch(e:any){setMsg(e?.response?.data?.message||'Unable to check password')}
  finally{setBusy(false)}
 }

 return <div className="feature-page">
  <h1>Security Center</h1>
  <p className="muted">Production security policies, header configurations, and defense mechanisms.</p>

  <div className="panel" style={{maxWidth:600}}>
   <h3>Password Policy Validator</h3>
   <p className="muted">Test passwords against the SaaS strength rules (length, uppercase, lowercase, numbers, symbols).</p>
   <div className="form-inline">
    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Type a password to test…"/>
    <button onClick={check} disabled={busy || !password}>{busy?'Validating…':'Check Strength'}</button>
   </div>
   {result&&<div style={{marginTop:14}}>
    Valid: <span className={`badge ${result.valid?'active':'expired'}`}>{result.valid?'PASSED':'FAILED'}</span>
    <div className="muted" style={{marginTop:8,fontSize:13}}>{result.requirements?.join(' · ')}</div>
   </div>}
   {msg&&<div className="error" style={{marginTop:10}}>{msg}</div>}
  </div>

  <div className="panel" style={{marginTop:16,maxWidth:600}}>
   <h3>Active Security Hardening</h3>
   <div className="list">
    <div className="list-row"><b>Rate Limiting</b><span>120 requests/minute per client IP/user</span></div>
    <div className="list-row"><b>Security Headers</b><span>nosniff, DENY frame options, referrer policy</span></div>
    <div className="list-row"><b>Brute Force Protection</b><span>Account lockout & failed login monitoring</span></div>
    <div className="list-row"><b>Audit Trail</b><span>Comprehensive user and school action logging</span></div>
    <div className="list-row"><b>Idempotency</b><span>Webhook & payment transaction deduplication</span></div>
   </div>
  </div>
 </div>
}
