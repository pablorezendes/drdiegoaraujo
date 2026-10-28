import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceFile = fileURLToPath(import.meta.url);
const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const realRoot = await realpath(root);
const expectedTitle = '<title>Dr. Diego de Araújo · Fisioterapeuta — NOÉRION</title>';
if (!(await readFile(path.join(root, 'index.html'), 'utf8')).includes(expectedTitle)) {
  throw new Error('A página V15 esperada não foi encontrada. Inicialização interrompida.');
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
const pages = new Map([['/', '/index.html'], ['/conversa', '/conversa.html'], ['/privacidade', '/privacidade.html'], ['/termos', '/termos.html']]);
const aliases = new Map([['/index.html', '/'], ['/conversa.html', '/conversa'], ['/privacidade.html', '/privacidade'], ['/termos.html', '/termos'], ['/conversa/', '/conversa'], ['/privacidade/', '/privacidade'], ['/termos/', '/termos']]);
const securityHeaders = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
const inside = target => target === realRoot || target.startsWith(realRoot + path.sep);

function reply(req, res, status, body, headers = {}) {
  const content = Buffer.from(body);
  res.writeHead(status, { ...securityHeaders, 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': content.length, ...headers });
  res.end(req.method === 'HEAD' ? undefined : content);
}

export function createPublicServer() {
  return http.createServer(async (req, res) => {
    try {
      const raw = req.url || '/';
      const queryAt = raw.indexOf('?');
      const rawPath = queryAt < 0 ? raw : raw.slice(0, queryAt);
      const query = queryAt < 0 ? '' : raw.slice(queryAt);
      const pathname = decodeURIComponent(rawPath);
      if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(pathname)) {
        reply(req, res, 400, 'Endereço inválido.'); return;
      }
      const segments = pathname.split('/');
      if (segments.includes('..') || segments.includes('.')) { reply(req, res, 403, 'Acesso não permitido.'); return; }
      if (segments.some(segment => segment.startsWith('.'))) { reply(req, res, 404, 'Página não encontrada.'); return; }
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        req.resume();
        reply(req, res, 503, JSON.stringify({ ok: false, message: 'O envio está indisponível no momento. Tente novamente mais tarde.' }), { 'Content-Type': 'application/json; charset=utf-8' }); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        req.resume(); reply(req, res, 405, 'Método não permitido.', { Allow: 'GET, HEAD' }); return;
      }
      if (aliases.has(pathname)) { reply(req, res, 308, '', { Location: aliases.get(pathname) + query, 'Cache-Control': 'no-cache' }); return; }
      const target = path.resolve(root, '.' + (pages.get(pathname) || pathname));
      if (target !== root && !target.startsWith(root + path.sep)) { reply(req, res, 403, 'Acesso não permitido.'); return; }
      const resolved = await realpath(target);
      if (!inside(resolved)) { reply(req, res, 403, 'Acesso não permitido.'); return; }
      const info = await stat(resolved);
      if (!info.isFile()) { reply(req, res, 404, 'Página não encontrada.'); return; }
      const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
      const headers = { ...securityHeaders, 'Content-Type': types[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/img/') ? 'public, max-age=3600, must-revalidate' : 'no-cache', ETag: etag, 'Last-Modified': info.mtime.toUTCString() };
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
      if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'Content-Length': info.size }).end(); return; }
      const data = await readFile(resolved);
      res.writeHead(200, { ...headers, 'Content-Length': data.length });
      res.end(data);
    } catch (error) {
      reply(req, res, error instanceof URIError ? 400 : 404, error instanceof URIError ? 'Endereço inválido.' : 'Página não encontrada.');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === sourceFile) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser uma porta entre 1 e 65535.');
  createPublicServer().listen(port, '127.0.0.1', () => console.log(`V15 local: http://localhost:${port}`));
}
