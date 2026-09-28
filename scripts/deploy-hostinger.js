import * as ftp from 'basic-ftp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  const host = process.env.HOSTINGER_FTP_SERVER || process.argv[2];
  const user = process.env.HOSTINGER_FTP_USERNAME || process.argv[3];
  const password = process.env.HOSTINGER_FTP_PASSWORD || process.argv[4];
  const remoteDir = process.env.HOSTINGER_SERVER_DIR || process.argv[5] || 'domains/optinetinnovations.in/public_html/attendoschool';

  if (!host || !user || !password) {
    console.error('❌ Missing credentials!');
    console.log('Usage: node scripts/deploy-hostinger.js <FTP_HOST> <FTP_USER> <FTP_PASSWORD> [REMOTE_DIR]');
    console.log('Or set HOSTINGER_FTP_SERVER, HOSTINGER_FTP_USERNAME, HOSTINGER_FTP_PASSWORD environment variables.');
    process.exit(1);
  }

  const cleanHost = host.replace(/^(https?|ftps?):\/\//i, '').replace(/\/$/, '');

  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    console.log(`🔌 Connecting to ${cleanHost} via FTPS...`);
    await client.access({
      host: cleanHost,
      user: user,
      password: password,
      secure: true,
      port: 21,
      secureOptions: {
        rejectUnauthorized: false
      }
    });

    console.log(`📂 Ensuring remote directory ${remoteDir} exists...`);
    await client.ensureDir(remoteDir);
    await client.clearWorkingDir();

    const localDir = path.resolve(__dirname, '../frontend/dist');
    console.log(`🚀 Uploading ${localDir} to ${remoteDir}...`);
    await client.uploadFromDir(localDir);

    console.log('✅ Deployment to Hostinger completed successfully!');
    console.log('🌐 Visit: https://attendoschool.optinetinnovations.in');
  } catch (err) {
    console.error('❌ Deployment error:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
