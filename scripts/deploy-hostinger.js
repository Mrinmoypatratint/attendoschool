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
    const candidateDirs = [];

    if (process.env.HOSTINGER_SERVER_DIR && process.env.HOSTINGER_SERVER_DIR !== '.' && process.env.HOSTINGER_SERVER_DIR !== './') {
      candidateDirs.push(process.env.HOSTINGER_SERVER_DIR);
    } else if (lowerNames.includes('attendo-school-logo.png') || lowerNames.includes('index.html') || lowerNames.includes('assets')) {
      console.log('🎯 Detected website root directory directly upon login.');
      candidateDirs.push('.');
    } else {
      // Primary domain subdomains in Hostinger live in public_html/attendoschool
      if (lowerNames.includes('public_html')) {
        candidateDirs.push('public_html/attendoschool');
      }
      // Addon domain subdomains live in domains/optinetinnovations.in/public_html/attendoschool
      if (lowerNames.includes('domains')) {
        candidateDirs.push('domains/optinetinnovations.in/public_html/attendoschool');
      }
    }

    console.log(`📋 Target directories to sync (${candidateDirs.length}):`, candidateDirs.join(', '));
    const localDir = path.resolve(__dirname, '../frontend/dist');

    for (const dir of candidateDirs) {
      console.log(`🚀 Uploading ${localDir} to ${dir}...`);
      try {
        if (dir !== '.') {
          await client.ensureDir(dir);
        }
        await client.uploadFromDir(localDir);
        console.log(`✅ Successfully uploaded to ${dir}!`);
      } catch (uploadErr) {
        console.warn(`⚠️ Error uploading to ${dir}:`, uploadErr.message);
      }
      await client.cd('/');
    }

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

