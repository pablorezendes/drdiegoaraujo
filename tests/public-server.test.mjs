import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { after, before, describe, test } from 'node:test';
import { createPublicServer } from '../server.mjs';

describe('servidor público V15', () => {
  let server;
  let base;

  before(async () => {
    server = createPublicServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (!server?.listening) return;
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  test('serve a página inicial e as três rotas limpas com seus títulos', async () => {
    for (const [route, title] of [
      ['/', 'Dr. Diego de Araújo · Fisioterapeuta — NOÉRION'],
      ['/conversa', 'Solicitar uma conversa · NOÉRION'],
      ['/privacidade', 'Política de Privacidade · NOÉRION'],
      ['/termos', 'Termos de uso · NOÉRION'],
    ]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.ok((await response.text()).includes(`<title>${title}</title>`), route);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
  });

  test('redireciona aliases HTML e barras finais preservando a query', async () => {
    for (const [route, canonical] of [
      ['/index.html', '/'], ['/conversa.html', '/conversa'],
      ['/privacidade.html', '/privacidade'], ['/termos.html', '/termos'],
      ['/conversa/', '/conversa'], ['/privacidade/', '/privacidade'], ['/termos/', '/termos'],
    ]) {
      const response = await fetch(base + route + '?origem=teste', { redirect: 'manual' });
      assert.equal(response.status, 308, route);
      assert.equal(response.headers.get('location'), canonical + '?origem=teste');
    }
  });

  test('HEAD mantém os metadados sem corpo e arquivos rejeitam outros métodos', async () => {
    const get = await fetch(base + '/conversa');
    const head = await fetch(base + '/conversa', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), get.headers.get('content-length'));
    assert.equal(head.headers.get('content-type'), get.headers.get('content-type'));
    assert.equal(await head.text(), '');
    await get.arrayBuffer();
    const post = await fetch(base + '/', { method: 'POST', body: '{}' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
  });

  test('arquivos inexistentes ou privados retornam 404 sem fallback da landing', async () => {
    for (const route of ['/inexistente', '/inexistente.js', '/package.json', '/.env', '/img/']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 404, route);
      assert.doesNotMatch(await response.text(), /<title>|Quem cuida de você/);
    }
  });

  test('recusa travessia de diretório e codificações inválidas', async () => {
    // http.get conserva o caminho bruto; fetch normalizaria segmentos antes do envio.
    for (const [pathname, expected] of [
      ['/%2e%2e/package.json', 403], ['/..%5cpackage.json', 400], ['/%ZZ', 400],
    ]) {
      const status = await new Promise((resolve, reject) => {
        const request = http.get(base, { path: pathname }, response => {
          response.resume();
          response.once('end', () => resolve(response.statusCode));
          response.once('error', reject);
        });
        request.once('error', reject);
      });
      assert.equal(status, expected, pathname);
    }
  });

  test('API de contato permanece indisponível com JSON honesto e sem cache', async () => {
    const response = await fetch(base + '/api/conversa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 503);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.equal(result.ok, false);
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0);
  });
});
