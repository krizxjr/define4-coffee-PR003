import './generate-config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  // Never serve .env files or local development scripts to the browser.
  if (pathname.split('/').some((segment) => segment.startsWith('.')) || pathname.startsWith('/scripts/')) {
    res.writeHead(404).end('Not found');
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  const filePath = path.resolve(projectDir, `.${pathname}`);
  if (filePath !== projectDir && !filePath.startsWith(projectDir + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const headers = { 'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' };
    if (path.basename(filePath) === 'config.js') headers['Cache-Control'] = 'no-store';
    if (req.method === 'HEAD') {
      res.writeHead(200, headers).end();
      return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath)
      .on('error', () => { if (!res.headersSent) res.writeHead(500); res.end('Server error'); })
      .pipe(res);
  });
});

server.listen(port, host, () => {
  console.log(`Open Attic frontend running at http://${host}:${port}`);
  console.log('Press Ctrl+C to stop.');
});
