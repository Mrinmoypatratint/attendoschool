import { processSmsQueue } from '../services/smsService';
async function run(){const result=await processSmsQueue(100);console.log('SMS worker',result);}
run().catch(e=>{console.error(e);process.exit(1)});
