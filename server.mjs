import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A landing completa em dist/ permanece fora do ar ate autorizacao humana explicita.
const root = path.resolve(fileURLToPath(new URL('./maintenance/', import.meta.url)));
const maintenanceTitle = '<title>Dr. Diego de Araújo — Site em manutenção</title>';
const maintenancePage = await readFile(path.join(root, 'index.html'), 'utf8');
if (!maintenancePage.includes(maintenanceTitle)) {
  throw new Error('A página de manutenção obrigatória não foi encontrada. Publicação interrompida.');
}
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, 'index.html') : target;
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Página não encontrada.'); }
}).listen(port, '127.0.0.1', () => console.log(`Manutenção: http://localhost:${port}`));
