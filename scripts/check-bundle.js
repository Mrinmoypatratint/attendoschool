const fs = require('fs');
const path = require('path');

const dir = '/home/attendoschool/htdocs/attendoschool.online/frontend/dist/assets';
if (!fs.existsSync(dir)) {
  console.log('Directory not found:', dir);
  process.exit(0);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const file of files) {
  const c = fs.readFileSync(path.join(dir, file), 'utf8');
  const localMatches = c.match(/(?:http:\/\/localhost[^\s"'`]*|http:\/\/127\.0\.0\.1[^\s"'`]*)/g) || [];
  const renderMatches = c.match(/(?:https?:\/\/[a-zA-Z0-9.-]*render\.com[^\s"'`]*)/g) || [];
  console.log(`Checking ${file}:`);
  if (localMatches.length > 0) {
    console.log('  WARNING - Localhost matches found:', [...new Set(localMatches)]);
  } else {
    console.log('  CLEAN - No localhost references found.');
  }
  if (renderMatches.length > 0) {
    console.log('  WARNING - Render matches found:', [...new Set(renderMatches)]);
  } else {
    console.log('  CLEAN - No render.com references found.');
  }
}
