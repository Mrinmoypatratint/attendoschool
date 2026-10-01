import * as ftp from 'basic-ftp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  const host = process.env.HOSTINGER_FTP_SERVER || process.argv[2];
  const user = process.env.HOSTINGER_FTP_USERNAME || process.argv[3];
  const password = process.env.HOSTINGER_FTP_PASSWORD || process.argv[4];

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
    console.log(`🔌 Connecting to ${cleanHost}:21 via FTPS...`);
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

    console.log('✅ Connected successfully!');
    const initialList = await client.list();
    const names = initialList.map(f => f.name);
    console.log(`📂 Initial directory contents (${names.length} items):`, names.slice(0, 15).join(', '));

    const lowerNames = names.map(n => n.toLowerCase());
    let targetDir = '.';

    if (process.env.HOSTINGER_SERVER_DIR && process.env.HOSTINGER_SERVER_DIR !== '.' && process.env.HOSTINGER_SERVER_DIR !== './') {
      targetDir = process.env.HOSTINGER_SERVER_DIR;
      console.log(`🎯 Using configured HOSTINGER_SERVER_DIR: ${targetDir}`);
      await client.ensureDir(targetDir);
    } else if (lowerNames.includes('attendo-school-logo.png') || lowerNames.includes('index.html') || lowerNames.includes('assets')) {
      console.log('🎯 Detected website root directory directly upon login.');
    } else if (lowerNames.includes('domains')) {
      targetDir = 'domains/optinetinnovations.in/public_html/attendoschool';
      console.log(`🎯 Navigating into ${targetDir}...`);
      await client.ensureDir(targetDir);
    } else if (lowerNames.includes('public_html')) {
      targetDir = 'public_html/attendoschool';
      console.log(`🎯 Navigating into ${targetDir}...`);
      await client.ensureDir(targetDir);
    }

    const localDir = path.resolve(__dirname, '../frontend/dist');
    console.log(`🚀 Uploading ${localDir} to ${targetDir}...`);
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

