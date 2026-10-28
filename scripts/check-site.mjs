import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const pages = ['index.html', 'conversa.html', 'privacidade.html', 'termos.html'];
const html = new Map(await Promise.all(pages.map(async file => [file, await readFile(path.join(dist, file), 'utf8')])));
const route = pathname => pathname === '/' ? 'index.html' : pathname.slice(1).replace(/\/$/, '') + (pathname.endsWith('.html') ? '' : '.html');
for (const [file, source] of html) {
  assert.match(source, /<html\s+lang="pt-BR"/i, `${file}: idioma`);
  assert.match(source, /<meta name="robots" content="noindex, nofollow, noarchive">/i, `${file}: bloqueio de indexação`);
  assert.equal([...source.matchAll(/<h1\b/gi)].length, 1, `${file}: um h1`);
  assert.match(source, /<main\b[^>]*id="conteudo"/i, `${file}: região principal`);
  assert.doesNotMatch(source, /\sstyle=|\son(?:click|submit|load)=/i, `${file}: sem código inline`);
  assert.doesNotMatch(source, /R\$|SIGNATURE EDITION|iTeraCare|biorresson[aâ]ncia|assets\/|5500000000000/i, `${file}: conteúdo antigo/placeholder`);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${file}: IDs únicos`);
  for (const [, attribute, value] of source.matchAll(/\b(href|src|srcset)="([^"]*)"/g)) {
    if (/^(?:https?:|mailto:|data:)/.test(value)) continue;
    const url = new URL(value, `https://drdiegoaraujo.com/${file === 'index.html' ? '' : file}`);
    const relative = decodeURIComponent(url.pathname);
    const targetFile = attribute === 'href' && (relative === '/' || /^\/(conversa|privacidade|termos)(\.html)?\/?$/.test(relative))
      ? route(relative) : relative.slice(1);
    const target = path.resolve(dist, targetFile);
    assert.ok(target.startsWith(dist + path.sep), `${file}: caminho dentro do dist`);
    assert.ok((await stat(target)).isFile(), `${file}: arquivo ${value}`);
    if (url.hash && html.has(targetFile)) assert.ok(html.get(targetFile).includes(`id="${url.hash.slice(1)}"`), `${file}: âncora ${value}`);
  }
}
const index = html.get('index.html');
assert.equal([...index.matchAll(/class="faq-item"/g)].length, 12, '12 perguntas V15');
for (const text of ['Origem', 'Corpo', 'Mente', 'Consciência', 'Integração', 'Terapia de Autoabsorção', 'CREFITO-11/362668-F', 'CREFITO-3']) assert.ok(index.includes(text), `Texto V15: ${text}`);
assert.equal([...index.matchAll(/<picture>/g)].length, 3, '3 fotos de referência');
assert.equal([...index.matchAll(/loading="lazy"/g)].length, 2, 'fotos secundárias sob demanda');
assert.equal([...index.matchAll(/fetchpriority="high"/g)].length, 1, 'prioridade do retrato');
const context = { window: {} };
vm.runInNewContext(await readFile(path.join(dist, 'site-config.js'), 'utf8'), context);
for (const flag of ['contactEnabled', 'legalApproved', 'photosApproved']) assert.equal(context.window.NOERION_CONFIG[flag], false, `Configuração pendente: ${flag}`);
assert.equal(context.window.NOERION_CONFIG.analytics?.enabled, false, 'Medição inativa');
assert.equal(context.window.NOERION_CONFIG.whatsapp, '', 'WhatsApp não confirmado');
assert.equal(context.window.NOERION_CONFIG.email, '', 'E-mail não confirmado');
assert.match(await readFile(path.join(dist, 'robots.txt'), 'utf8'), /Allow: \/\s*$/);

// Publicação V15 autorizada pelo usuário; SMTP e coleta continuam inativos.
const docker = await readFile(path.join(root, 'Dockerfile'), 'utf8');
assert.match(docker, /COPY dist\/ \/usr\/share\/nginx\/html\//);
assert.doesNotMatch(docker, /COPY\s+(?:maintenance|\.)\//);
const ignore = await readFile(path.join(root, '.dockerignore'), 'utf8');
assert.ok(ignore.trim().startsWith('**'));
assert.match(ignore, /!dist\/\*\*/);
assert.doesNotMatch(ignore, /!maintenance/);
const server = await readFile(path.join(root, 'server.mjs'), 'utf8');
assert.match(server, /new URL\('\.\/dist\/'/);
assert.doesNotMatch(server, /import .*contact-service|new URL\('\.\/maintenance\/'/);
assert.match(await readFile(path.join(root, 'maintenance/index.html'), 'utf8'), /<title>Dr\. Diego de Araújo — Site em manutenção<\/title>/);
console.log('V15: páginas, links, conteúdo, configuração e implantação autorizada verificados.');
