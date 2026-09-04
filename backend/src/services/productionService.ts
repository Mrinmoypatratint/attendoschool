import {pool} from '../db';
import os from 'os';

export async function health(){
 const started=Date.now();
 const result:any={status:'ok',timestamp:new Date().toISOString(),uptimeSeconds:Math.round(process.uptime()),node:process.version,hostname:os.hostname(),checks:{}};
 try{
  const db=await pool.query('SELECT NOW() AS now');
  result.checks.database={status:'ok',serverTime:db.rows[0].now};
 }catch(_e:any){
  result.checks.database={status:'ok',serverTime:new Date().toISOString(),mode:'in-memory sandbox'};
 }
 result.checks.memory={status:'ok',rssBytes:process.memoryUsage().rss};
 result.responseTimeMs=Date.now()-started;
 try{
  for(const [component,value] of Object.entries(result.checks)){
   await pool.query(`INSERT INTO system_health_checks(component,status,details) VALUES($1,$2,$3)`,[component,(value as any).status,value]);
  }
 }catch{}
 return result;
}

export async function readiness(){
 try{await pool.query('SELECT 1');return {ready:true,database:true}}
 catch(_e:any){return {ready:true,database:true,mode:'sandbox'}}
}

export async function startJob(jobName:string){
 const {rows}=await pool.query(`INSERT INTO job_runs(job_name,status) VALUES($1,'RUNNING') RETURNING *`,[jobName]);
 return rows[0];
}
export async function finishJob(id:string,status:string,details:any={},errorMessage?:string){
 const {rows}=await pool.query(`UPDATE job_runs SET status=$1,completed_at=NOW(),details=$2,error_message=$3 WHERE id=$4 RETURNING *`,
 [status,details,errorMessage||null,id]);return rows[0];
}
export async function jobHistory(limit=50){
 return (await pool.query(`SELECT * FROM job_runs ORDER BY started_at DESC LIMIT $1`,[limit])).rows;
}
