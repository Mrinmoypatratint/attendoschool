const fs = require('fs');
const path = '/home/attendoschool/htdocs/attendoschool.online/.env';
const backendPath = '/home/attendoschool/htdocs/attendoschool.online/backend/.env';

function setEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  return content.trimEnd() + `\n${key}=${value}\n`;
}

if (fs.existsSync(path)) {
  let c = fs.readFileSync(path, 'utf8');
  c = setEnvVar(c, 'PORT', '3000');
  c = setEnvVar(c, 'FRONTEND_URL', 'https://attendoschool.online');
  c = setEnvVar(c, 'APP_BASE_URL', 'https://attendoschool.online');
  c = setEnvVar(c, 'VITE_API_URL', '/api');
  c = setEnvVar(c, 'CORS_ORIGIN', 'https://attendoschool.online,https://www.attendoschool.online,http://localhost:5173,https://attendoschool.optinetinnovations.in');
  fs.writeFileSync(path, c);
  fs.writeFileSync(backendPath, c);

  const frontendEnvPath = '/home/attendoschool/htdocs/attendoschool.online/frontend/.env';
  const frontendEnvProdPath = '/home/attendoschool/htdocs/attendoschool.online/frontend/.env.production';
  
  fs.writeFileSync(frontendEnvPath, c);
  if (fs.existsSync(frontendEnvProdPath)) {
    let p = fs.readFileSync(frontendEnvProdPath, 'utf8');
    p = setEnvVar(p, 'VITE_API_URL', '/api');
    fs.writeFileSync(frontendEnvProdPath, p);
  }

  console.log('VPS Environment files synchronized successfully:');
  console.log('  PORT=3000');
  console.log('  VITE_API_URL=/api');
  console.log('  FRONTEND_URL=https://attendoschool.online');
} else {
  console.error('.env not found at ' + path);
  process.exit(1);
}
