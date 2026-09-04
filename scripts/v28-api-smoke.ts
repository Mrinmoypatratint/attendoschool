const base=(process.env.BASE_URL||'http://localhost:5000').replace(/\/$/,'');
const paths=['/api/production-v26/health','/api/production-v26/ready','/api/final-v28/db-check','/api/final-v28/migration-smoke','/api/final-v28/integrity'];
(async()=>{let failed=0;for(const path of paths){try{const r=await fetch(base+path);console.log(`${r.ok?'PASS':'FAIL'} ${path} ${r.status}`);if(!r.ok)failed++;}catch(e){console.log('FAIL',path);failed++;}}if(failed)process.exitCode=1;else console.log('V28 API smoke checks passed.');})();
