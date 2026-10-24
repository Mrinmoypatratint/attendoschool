const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');

async function decommission() {
  const host = process.env.HOSTINGER_FTP_SERVER || process.argv[2];
  const user = process.env.HOSTINGER_FTP_USERNAME || process.argv[3];
  const password = process.env.HOSTINGER_FTP_PASSWORD || process.argv[4];

  if (!host || !user || !password) {
    console.error('❌ Missing credentials!');
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

    const candidateDirs = new Set();
    const lowerNames = names.map(n => n.toLowerCase());

    if (lowerNames.includes('index.html') && lowerNames.includes('assets')) {
      candidateDirs.add('.');
    }

    try {
      const domainsList = await client.list('/domains');
      const dNames = domainsList.map(f => f.name);
      for (const d of dNames) {
        if (d.toLowerCase().includes('attendoschool')) {
          candidateDirs.add(`/domains/${d}/public_html`);
        }
        if (d.toLowerCase().includes('optinetinnovations')) {
          candidateDirs.add(`/domains/${d}/public_html/attendoschool`);
        }
      }
    } catch (e) {
      console.log('ℹ️ /domains note:', e.message);
    }

    try {
      const publicHtmlList = await client.list('/public_html');
      const pNames = publicHtmlList.map(f => f.name);
      if (pNames.map(x => x.toLowerCase()).includes('attendoschool')) {
        candidateDirs.add('/public_html/attendoschool');
      }
    } catch (e) {
      console.log('ℹ️ /public_html note:', e.message);
    }

    if (process.env.HOSTINGER_SERVER_DIR && process.env.HOSTINGER_SERVER_DIR !== '.' && process.env.HOSTINGER_SERVER_DIR !== './') {
      candidateDirs.add(process.env.HOSTINGER_SERVER_DIR);
    }

    const targets = Array.from(candidateDirs);
    console.log(`📋 Target directories to decommission and replace with redirect (${targets.length}):`, targets.join(' | '));

    const redirectDir = path.resolve(__dirname, '../redirect-dist');
    if (!fs.existsSync(redirectDir)) {
      fs.mkdirSync(redirectDir, { recursive: true });
    }

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=https://attendoschool.online/">
  <title>AttendoSchool - Moved Permanently</title>
  <script>
    var hash = window.location.hash || '';
    window.location.replace("https://attendoschool.online/" + hash);
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center; max-width: 500px; padding: 2rem; background: #1e293b; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <h1 style="color: #38bdf8; margin-bottom: 1rem;">Service Relocated</h1>
    <p style="color: #94a3b8; line-height: 1.6;">AttendoSchool has permanently moved to its official production domain:</p>
    <p style="margin: 1.5rem 0;"><a href="https://attendoschool.online/" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Go to attendoschool.online</a></p>
    <p style="font-size: 0.85rem; color: #64748b;">Redirecting automatically...</p>
  </div>
</body>
</html>
`;

    const htaccess = `RewriteEngine On
RewriteCond %{HTTP_HOST} ^attendoschool\\.optinetinnovations\\.in$ [NC]
RewriteRule ^(.*)$ https://attendoschool.online/$1 [R=301,L]
`;

    fs.writeFileSync(path.join(redirectDir, 'index.html'), indexHtml, 'utf8');
    fs.writeFileSync(path.join(redirectDir, '.htaccess'), htaccess, 'utf8');

    for (const dir of targets) {
      console.log(`🧹 Clearing and replacing ${dir} with redirect files...`);
      try {
        if (dir !== '.') {
          await client.ensureDir(dir);
        }
        await client.uploadFromDir(redirectDir);
        console.log(`✅ Uploaded redirect to ${dir}`);
      } catch (err) {
        console.warn(`⚠️ Warning on ${dir}:`, err.message);
      }
      await client.cd('/');
    }

    console.log('🎉 Hostinger FTP decommissioning completed successfully!');
  } catch (err) {
    console.error('❌ Decommissioning error:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

decommission();
