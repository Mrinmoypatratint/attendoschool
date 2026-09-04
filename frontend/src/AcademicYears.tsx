import React, { useEffect, useState } from 'react';
import {api} from './api';

export default function AcademicYearsV15() {
  const [items,setItems]=useState<any[]>([]);
  const [name,setName]=useState('');
  const [startDate,setStartDate]=useState('');
  const [endDate,setEndDate]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);

  async function load() {
    setLoading(true);
    try { const r=await api.get('/academic-years-v15'); setItems(r.data); }
    catch(e:any){setMessage(e?.response?.data?.message||e?.message||'Unable to load');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent) {
    e.preventDefault(); setMessage('');
    try {
      await api.post('/academic-years-v15',{name,startDate,endDate,makeActive:items.length===0});
      setName(''); setStartDate(''); setEndDate(''); await load();
    } catch(e:any){setMessage(e?.response?.data?.message||e?.message||'Create failed');}
  }

  async function action(id:string,type:'activate'|'archive') {
    try { await api.post(`/academic-years-v15/${id}/${type}`); await load(); }
    catch(e:any){setMessage(e?.response?.data?.message||e?.message||'Action failed');}
  }

  return <div className="feature-page">
    <h1>Academic Years</h1>
    <p className="muted">Manage school sessions while preserving historical attendance.</p>

    <div className="form-card">
      <h3>Create Academic Year</h3>
      <form onSubmit={create} className="form-inline">
        <input placeholder="e.g. 2026–27" value={name} onChange={e=>setName(e.target.value)} required/>
        <label>Start date <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required/></label>
        <label>End date <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} required/></label>
        <button type="submit">Create</button>
      </form>
    </div>

    {message&&<div className="error">{message}</div>}
    {loading?<p className="muted">Loading…</p>:
    <div className="table-wrap">
      <table>
        <thead><tr>{['Year','Start','End','Students','Classes','Status','Actions'].map(h=>
          <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {items.map(x=><tr key={x.id}>
            <td><b>{x.name}</b></td>
            <td>{String(x.start_date).slice(0,10)}</td>
            <td>{String(x.end_date).slice(0,10)}</td>
            <td>{x.student_count}</td>
            <td>{x.class_count}</td>
            <td>
              <span className={`badge ${x.is_archived?'expired':x.is_active?'active':''}`}>
                {x.is_archived?'Archived':x.is_active?'Active':'Inactive'}
              </span>
            </td>
            <td>
              <div className="action-row">
                {!x.is_active&&!x.is_archived&&<button className="small-btn" onClick={()=>action(x.id,'activate')}>Activate</button>}
                {!x.is_active&&!x.is_archived&&<button className="small-btn danger-btn" onClick={()=>action(x.id,'archive')}>Archive</button>}
              </div>
            </td>
          </tr>)}
          {!items.length&&<tr><td colSpan={7} className="muted" style={{padding:20}}>No academic years created.</td></tr>}
        </tbody>
      </table>
    </div>}
  </div>;
}
