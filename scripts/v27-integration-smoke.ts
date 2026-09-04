
/*
 V27 smoke runner. Set BASE_URL and a valid token.
 This intentionally tests public health/readiness first; authenticated
 feature tests should be run in staging with seeded demo data.
*/
const base=process.env.BASE_URL||'http://localhost:5000';
async function check(path:string){
 const r=await fetch(`${base}${path}`);
 console.log(path,r.status);
 if(!r.ok) throw new Error(`${path} failed`);
}
(async()=>{
 await check('/api/production-v26/health');
 await check('/api/production-v26/ready');
 console.log('V27 basic production smoke checks passed.');
})().catch(e=>{console.error(e);process.exit(1)});
