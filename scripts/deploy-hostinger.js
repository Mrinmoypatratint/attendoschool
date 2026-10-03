const ftp = require('basic-ftp');
const path = require('path');

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
    const candidateDirs = new Set();

    // Check if initial directory had index.html & assets
    if (lowerNames.includes('index.html') && lowerNames.includes('assets')) {
      console.log('🎯 Login directory contains website files (.): Adding . to targets.');
      candidateDirs.add('.');
    }

    // Inspect /domains
    try {
      const domainsList = await client.list('/domains');
      const dNames = domainsList.map(f => f.name);
      console.log(`🌐 /domains items (${dNames.length}):`, dNames.join(', '));
      for (const d of dNames) {
        if (d.toLowerCase().includes('attendoschool')) {
          candidateDirs.add(`/domains/${d}/public_html`);
          candidateDirs.add(`/domains/${d}`);
        }
        if (d.toLowerCase().includes('optinetinnovations')) {
          candidateDirs.add(`/domains/${d}/public_html/attendoschool`);
        }
      }
    } catch (e) {
      console.log('ℹ️ /domains check note:', e.message);
    }

    // Inspect /public_html
    try {
      const publicHtmlList = await client.list('/public_html');
      const pNames = publicHtmlList.map(f => f.name);
      console.log(`📂 /public_html items (${pNames.length}):`, pNames.slice(0, 15).join(', '));
      if (pNames.map(x => x.toLowerCase()).includes('attendoschool')) {
        candidateDirs.add('/public_html/attendoschool');
      }
    } catch (e) {
      console.log('ℹ️ /public_html check note:', e.message);
    }

    // Add explicit configured directory if provided
    if (process.env.HOSTINGER_SERVER_DIR && process.env.HOSTINGER_SERVER_DIR !== '.' && process.env.HOSTINGER_SERVER_DIR !== './') {
      candidateDirs.add(process.env.HOSTINGER_SERVER_DIR);
    }

    const targets = Array.from(candidateDirs);
    console.log(`📋 Total target directories to sync (${targets.length}):`, targets.join(' | '));
    const localDir = path.resolve(__dirname, '../frontend/dist');

    for (const dir of targets) {
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

