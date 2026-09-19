
import { processNotificationQueue } from '../services/notificationService';
async function run(){
 const result=await processNotificationQueue(100);
 console.log('[notification-worker]',result);
 process.exit(0);
}
run().catch(e=>{console.error(e);process.exit(1)});
