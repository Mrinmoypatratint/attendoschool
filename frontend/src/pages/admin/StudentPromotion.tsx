import React,{useEffect,useState} from 'react';
import {api} from '../../api';

export default function StudentPromotion(){
 const [fromYear,setFromYear]=useState('');
 const [toYear,setToYear]=useState('');
 const [years,setYears]=useState<any[]>([]);
 const [items,setItems]=useState<any[]>([]);
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [outcome,setOutcome]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 const [loading,setLoading]=useState(false);

 async function loadYears(){
  try{const r=await api.get('/academic-years');setYears(r.data);
   if(!fromYear&&r.data.length) setFromYear(r.data.find((x:any)=>x.is_active)?.id||r.data[0].id);
  }catch(e:any){setMessage(e?.response?.data?.message||'Unable to load years');}
 }
 async function loadCandidates(){
  if(!fromYear)return;
  setLoading(true);
  try{const r=await api.get('/student-promotions/candidates',{params:{fromYearId:fromYear}});
   setItems(r.data); setSelected({}); setOutcome({});
  }catch(e:any){setMessage(e?.response?.data?.message||'Unable to load students');}
  finally{setLoading(false);}
 }
 useEffect(()=>{loadYears()},[]);
 useEffect(()=>{loadCandidates()},[fromYear]);

 async function process(){
  const selectedItems=items.filter(x=>selected[x.id]&&!x.already_processed)
   .map(x=>({studentId:x.id,outcome:outcome[x.id]||'PROMOTED'}));
  if(!toYear||!selectedItems.length){setMessage('Select a target academic year and at least one student.');return;}
  try{
   const r=await api.post('/student-promotions/process',{fromYearId:fromYear,toYearId:toYear,items:selectedItems});
   setMessage(`${r.data.length} student(s) processed successfully.`); await loadCandidates();
  }catch(e:any){setMessage(e?.response?.data?.message||e?.message||'Promotion failed');}
 }

 return <div className="feature-page">
  <h1>Student Promotion</h1>
  <p className="muted">Carry students into a new academic year while keeping historical attendance.</p>

  <div className="filter-row">
   <label>From <select value={fromYear} onChange={e=>setFromYear(e.target.value)}>
    <option value="">Select</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}
   </select></label>
   <label>To <select value={toYear} onChange={e=>setToYear(e.target.value)}>
    <option value="">Select</option>{years.filter(y=>y.id!==fromYear&&!y.is_archived).map(y=><option key={y.id} value={y.id}>{y.name}</option>)}
   </select></label>
   <button onClick={process}>Process Selected</button>
  </div>

  {message&&<div className="success">{message}</div>}

  {loading?<p className="muted">Loading…</p>:
  <div className="table-wrap">
   <table>
    <thead><tr>{['Select','Student','Roll','Current Class','Section','Outcome','Status'].map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{items.map(x=><tr key={x.id}>
     <td><input type="checkbox" disabled={x.already_processed} checked={!!selected[x.id]} onChange={e=>setSelected({...selected,[x.id]:e.target.checked})}/></td>
     <td><b>{x.name}</b></td><td>{x.roll}</td>
     <td>{x.from_class_name||'-'}</td><td>{x.from_section_name||'-'}</td>
     <td><select disabled={!selected[x.id]} value={outcome[x.id]||'PROMOTED'} onChange={e=>setOutcome({...outcome,[x.id]:e.target.value})}>
       <option>PROMOTED</option><option>RETAINED</option><option>GRADUATED</option><option>TRANSFERRED</option>
     </select></td>
     <td><span className={`badge ${x.already_processed?'sent':'queued'}`}>{x.already_processed?'Processed':'Pending'}</span></td>
    </tr>)}{!items.length&&<tr><td colSpan={7} className="muted" style={{padding:20}}>No students found for this academic year.</td></tr>}</tbody>
   </table>
  </div>}
 </div>;
}
