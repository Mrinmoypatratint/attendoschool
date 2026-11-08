import * as production from '../services/productionService';
import {enforceSubscriptions} from '../services/subscriptionEnforcementService';
import {processScheduled} from '../services/communicationService';
import {cleanupSecurity} from '../services/securityService';

async function run(name:string,fn:()=>Promise<any>){
 const job=await production.startJob(name);
 try{const result=await fn();await production.finishJob(job.id,'COMPLETED',result);console.log(`[job] ${name}`,result)}
 catch(e:any){await production.finishJob(job.id,'FAILED',{},e.message);console.error(`[job] ${name}`,e)}
}
async function main(){
 await run('subscription-enforcement',enforceSubscriptions);
 await run('scheduled-communications',processScheduled);
 await run('security-cleanup',cleanupSecurity);
 // Backup retention belongs to the dedicated backup worker (same queue and lock).
}
main().catch(e=>{console.error(e);process.exit(1)});
