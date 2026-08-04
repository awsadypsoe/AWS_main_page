const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(rootDir, '.env'));

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.avif': 'image/avif',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/config') {
    return { type: 'config' };
  }

  if (pathname === '/' || pathname === '') {
    return { type: 'file', filePath: path.join(rootDir, 'index.html') };
  }

  const cleanPath = pathname.replace(/^\/+/, '');
  const candidate = path.join(rootDir, cleanPath);

  if (candidate.startsWith(rootDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return { type: 'file', filePath: candidate };
  }

  if (!path.extname(cleanPath)) {
    const htmlCandidate = path.join(rootDir, `${cleanPath}.html`);
    if (htmlCandidate.startsWith(rootDir) && fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      return { type: 'file', filePath: htmlCandidate };
    }
  }

  return { type: 'missing' };
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  const route = resolveRequestPath(req.url);

  if (route.type === 'config') {
    sendJson(res, 200, {
      WEB3FORMS_ACCESS_KEY: process.env.WEB3FORMS_ACCESS_KEY || '',
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      MAX_SEATS: process.env.MAX_SEATS || '100',
      STORAGE_BUCKET: process.env.STORAGE_BUCKET || 'payment-screenshots',
    });
    return;
  }

  if (route.type === 'file') {
    sendFile(res, route.filePath);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Local server running at http://localhost:${port}`);
});