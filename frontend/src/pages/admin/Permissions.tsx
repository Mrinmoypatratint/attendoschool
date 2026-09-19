import React,{useEffect,useState} from 'react';
import {api} from '../../api';

export default function Permissions(){
 const [roles,setRoles]=useState<any[]>([]),[permissions,setPermissions]=useState<any[]>([]);
 const [message,setMessage]=useState('');
 const [loading,setLoading]=useState(false);

 async function load(){
  setLoading(true);
  try{
   await api.post('/permissions/seed');
   const [r,p]=await Promise.all([
    api.get('/permissions/roles'),api.get('/permissions/permissions')]);
   setRoles(r.data);setPermissions(p.data);
  }
  catch(e:any){setMessage(e?.response?.data?.message||e?.message||'Unable to load permissions')}
  finally{setLoading(false);}
 }
 useEffect(()=>{load()},[]);

 return <div className="feature-page">
  <h1>Admin Roles & Permissions</h1>
  <p className="muted">Granular permissions for School Admin operations and role-based access control.</p>

  {message&&<div className="error">{message}</div>}

  {loading?<p className="muted">Loading…</p>:
  <div className="table-wrap">
   <table>
    <thead><tr><th>Role</th><th>Description</th><th>Assigned Permissions</th></tr></thead>
    <tbody>{roles.map(r=><tr key={r.id}>
     <td><b>{r.name}</b></td>
     <td>{r.description}</td>
     <td>
      <div className="action-row">
       {(r.permissions||[]).map((p:string)=><span key={p} className="badge">{p}</span>)}
      </div>
     </td>
    </tr>)}{!roles.length&&<tr><td colSpan={3} className="muted" style={{padding:20}}>No custom roles defined yet.</td></tr>}</tbody>
   </table>
  </div>}

  <div className="panel" style={{marginTop:16}}>
   <h3>Available System Permissions</h3>
   <div className="action-row" style={{marginTop:10}}>
    {permissions.map(p=><span key={p.permission_key} className="badge" style={{background:'var(--gray-100)',color:'var(--text)'}}>{p.permission_key}</span>)}
   </div>
  </div>
 </div>
}
