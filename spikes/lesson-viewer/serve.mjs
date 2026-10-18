// THROWAWAY SPIKE: a tiny local web server for the lesson viewer. Not the product.
// Serves the viewer page at "/" and the built lesson packs (dist/content) at "/content/".
// Listens on 127.0.0.1 only, so nothing is exposed to the network.
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, 'public');
const CONTENT_DIR = path.resolve(here, '../../dist/content');
const FIRST_PORT = 5173;
const PORT_TRIES = 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
};

function locate(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const inContent = decoded.startsWith('/content/');
  const root = inContent ? CONTENT_DIR : PUBLIC_DIR;
  const rel = inContent ? decoded.slice('/content/'.length) : decoded.slice(1) || 'index.html';
  const file = path.resolve(root, rel);
  return file.startsWith(root + path.sep) ? file : null;
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = locate(url.pathname);
  if (file === null) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

function listen(port, triesLeft) {
  const server = http.createServer((req, res) => void handle(req, res));
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0 && !process.env.PORT) {
      listen(port + 1, triesLeft - 1);
      return;
    }
    console.error(`Could not start the viewer on port ${port}: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Lesson viewer (throwaway spike): http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.');
  });
}

try {
  await stat(path.join(CONTENT_DIR, 'manifest.json'));
} catch {
  console.error(`No built lessons in ${CONTENT_DIR}. Run: npm run content:build`);
  process.exit(1);
}
listen(Number(process.env.PORT) || FIRST_PORT, PORT_TRIES);
