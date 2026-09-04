
import React from 'react';

const modules=[
 ['V12','Attendance Reports'],['V13','Attendance Corrections'],
 ['V14','People Management'],['V15','Academic Years'],['V16','Student Promotion'],
 ['V17','Parent Portal'],['V18','Permissions'],['V19','Subscription Enforcement'],
 ['V20','Security'],['V21','Backup & Recovery'],['V22','Advanced Timetable'],
 ['V23','Offline Attendance'],['V24','Advanced Analytics'],['V25','Communication'],
 ['V26','Production']
];

export default function V27IntegrationHub(){
 return <section style={{padding:20}}>
  <h2>Integrated SaaS Modules</h2>
  <p>V12–V26 modules are packaged for final integration and production validation.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>
   {modules.map(([v,n])=><div key={v} style={{border:'1px solid #ddd',borderRadius:10,padding:14}}>
    <strong>{v}</strong><div>{n}</div><small>Integration target</small>
   </div>)}
  </div>
 </section>
}
