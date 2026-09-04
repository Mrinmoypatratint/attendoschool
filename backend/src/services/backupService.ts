import {pool} from '../db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {execFile} from 'child_process';
import {promisify} from 'util';
const execFileAsync=promisify(execFile);

const BACKUP_DIR=process.env.BACKUP_DIR||path.resolve(process.cwd(),'backups');

function checksum(file:string){
 return new Promise<string>((resolve,reject)=>{
  const h=crypto.createHash('sha256'); const s=fs.createReadStream(file);
  s.on('data',d=>h.update(d)); s.on('end',()=>resolve(h.digest('hex'))); s.on('error',reject);
 });
}

export async function createDatabaseBackup(){
 fs.mkdirSync(BACKUP_DIR,{recursive:true});
 const job=(await pool.query(`INSERT INTO backup_jobs(backup_type) VALUES('DATABASE') RETURNING *`)).rows[0];
 const fileName=`attendance_${new Date().toISOString().replace(/[:.]/g,'-')}.sql`;
 const file=path.join(BACKUP_DIR,fileName);
 try{
  const env={...process.env,PGPASSWORD:process.env.DB_PASSWORD||process.env.PGPASSWORD||''};
  const args=['-h',process.env.DB_HOST||'localhost','-p',process.env.DB_PORT||'5432','-U',process.env.DB_USER||'postgres','-d',process.env.DB_NAME||'attendance','-F','p','-f',file];
  await execFileAsync(process.env.PG_DUMP_PATH||'pg_dump',args,{env});
  const stat=fs.statSync(file), sha=await checksum(file);
  const r=await pool.query(`UPDATE backup_jobs SET status='COMPLETED',file_name=$1,storage_location=$2,size_bytes=$3,checksum_sha256=$4,completed_at=NOW() WHERE id=$5 RETURNING *`,
   [fileName,file,stat.size,sha,job.id]);
  return r.rows[0];
 }catch(e:any){
  await pool.query(`UPDATE backup_jobs SET status='FAILED',error_message=$1,completed_at=NOW() WHERE id=$2`,[e.message,job.id]);
  throw e;
 }
}

export async function listBackups(){
 return (await pool.query(`SELECT * FROM backup_jobs ORDER BY started_at DESC LIMIT 100`)).rows;
}

export async function restoreTest(backupJobId:string){
 const b=(await pool.query(`SELECT * FROM backup_jobs WHERE id=$1 AND status='COMPLETED'`,[backupJobId])).rows[0];
 if(!b)throw new Error('Completed backup not found');
 const t=(await pool.query(`INSERT INTO backup_restore_tests(backup_job_id,status,notes) VALUES($1,'STARTED','Restore test must run against an isolated database.') RETURNING *`,[backupJobId])).rows[0];
 // Deliberately do not overwrite the live production database.
 return {...t,safe:true,message:'Restore test registered. Run pg_restore/psql against an isolated staging database.'};
}

export async function cleanupOldBackups(retentionDays=30){
 fs.mkdirSync(BACKUP_DIR,{recursive:true});
 const cutoff=Date.now()-retentionDays*86400000; let removed=0;
 for(const name of fs.readdirSync(BACKUP_DIR)){
  const file=path.join(BACKUP_DIR,name); const st=fs.statSync(file);
  if(st.isFile()&&st.mtimeMs<cutoff){fs.unlinkSync(file);removed++}
 }
 return {removed,retentionDays};
}
