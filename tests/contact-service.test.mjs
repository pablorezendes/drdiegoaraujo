import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { MAX_BODY_BYTES, createContactService, validateContactPayload } from '../src/contact-service.mjs';

// Credenciais e pessoas fictícias; todos os transportes são injetados, sem SMTP real.
const env = {
  CONTACT_ENABLED: 'true', CONTACT_ALLOWED_ORIGINS: 'https://example.test',
  CONTACT_TEAM_EMAIL: 'equipe@example.test', CONTACT_PRIVACY_VERSION: 'politica-teste-v15',
  SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_SECURE: 'false',
  SMTP_USER: 'fixture', SMTP_PASS: 'fixture-not-a-secret', SMTP_FROM: 'site@example.test',
};
const payload = (overrides = {}) => ({ requestId: randomUUID(), para: 'mim', interesse: 'inteiro', origem: 'outro', indicacao: '', cidade: 'Brasília', valor: 'entender', nome: 'Pessoa de Teste', email: 'pessoa@example.test', whatsapp: '5561999999999', horario: 'tarde', privacidade: true, comunicacoes: false, site: '', ...overrides });
function recordingTransport() {
  const messages = [];
  return { messages, async sendMail(message) { messages.push(message); return { accepted: [message.to], rejected: [] }; } };
}
const service = (options = {}) => createContactService({ enabled: true, env, transport: recordingTransport(), ...options });

test('valida o contrato, normaliza texto e respeita limites de caracteres', () => {
  const normalized = validateContactPayload(payload({ nome: '  Nome de teste  ', email: 'pessoa@EXAMPLE.TEST', indicacao: 'A'.repeat(120), cidade: 'B'.repeat(120) }));
  assert.equal(normalized.nome, 'Nome de teste');
  assert.equal(normalized.email, 'pessoa@example.test');
  assert.equal(normalized.indicacao.length, 120);
  assert.equal(validateContactPayload(payload({ nome: 'A'.repeat(160) })).nome.length, 160);
  assert.equal(validateContactPayload(payload({ indicacao: undefined })).indicacao, '');
  for (const overrides of [
    { requestId: 'sem-uuid' }, { para: 'terceiro' }, { interesse: 'outro' }, { origem: 'google' },
    { cidade: '' }, { cidade: 'x'.repeat(121) }, { indicacao: 'x'.repeat(121) }, { indicacao: null },
    { nome: 'x'.repeat(161) }, { nome: 'Nome\r\nBcc: outro@example.test' },
    { email: 'invalid' }, { email: 'a..b@example.test' }, { email: 'x@-invalid.test' },
    { email: 'x'.repeat(65) + '@example.test' }, { email: 'x@example.test\n' },
    { whatsapp: '+55 (61) 99999-9999' }, { whatsapp: '123456789' }, { whatsapp: '1'.repeat(16) },
    { horario: 'madrugada' }, { valor: 'nao' }, { privacidade: false }, { privacidade: 'true' },
    { comunicacoes: undefined }, { comunicacoes: 'false' }, { site: undefined }, { saude: 'não solicitar' },
  ]) assert.throws(() => validateContactPayload(payload(overrides)));
  assert.throws(() => validateContactPayload(null));
  assert.throws(() => validateContactPayload([]));
});

test('exige opt-in duplo e configuração completa, sem chamar transporte', async () => {
  const transport = recordingTransport();
  for (const options of [
    { enabled: false, env }, { enabled: true, env: { ...env, CONTACT_ENABLED: 'false' } },
    { enabled: true, env: { ...env, SMTP_PASS: '' } },
    { enabled: true, env: { ...env, CONTACT_TEAM_EMAIL: 'inválido' } },
    { enabled: true, env: { ...env, CONTACT_ALLOWED_ORIGINS: 'https://example.test/' } },
    { enabled: true, env: { ...env, CONTACT_PRIVACY_VERSION: '' } },
  ]) {
    const contact = createContactService({ ...options, transport });
    assert.equal(contact.enabled, false);
    assert.equal((await contact.submit(payload())).status, 503);
  }
  assert.equal(transport.messages.length, 0);
});

test('honeypot rejeita o envio sem simular recebimento nem mandar e-mail', async () => {
  const transport = recordingTransport();
  const result = await service({ transport }).submit(payload({ site: 'https://spam.test' }));
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(transport.messages.length, 0);
});

test('aceitação da equipe antecede confirmação e registra consentimentos no servidor', async () => {
  const transport = recordingTransport();
  const data = payload();
  const result = await service({ transport, now: () => Date.parse('2026-10-28T12:00:00Z') }).submit(data);
  assert.deepEqual(result, { status: 200, body: { ok: true, acknowledgementSent: true } });
  assert.equal(transport.messages.length, 2);
  const [team, confirmation] = transport.messages;
  assert.equal(team.to, env.CONTACT_TEAM_EMAIL);
  assert.equal(team.replyTo.address, data.email);
  assert.match(team.text, /2026-10-28T12:00:00\.000Z/);
  assert.match(team.text, /política-teste-v15|politica-teste-v15/);
  assert.match(team.text, /Comunicações opcionais: Não/);
  assert.match(team.text, /Leitura\/aceite de privacidade declarado/);
  assert.equal(team.html, undefined);
  assert.equal(team.disableFileAccess, true);
  assert.equal(team.disableUrlAccess, true);
  assert.equal(confirmation.to, data.email);
  assert.equal(confirmation.subject, 'Recebemos a sua solicitação');
  assert.equal(confirmation.text, `Olá, ${data.nome}. Recebemos a sua solicitação de conversa. Em até 2 dias úteis, entramos em contato para marcar o melhor horário.\nDr. Diego de Araújo · NOÉRION`);
  assert.equal(confirmation.replyTo, undefined);
  assert.notEqual(team.messageId, confirmation.messageId);
});

test('SMTP falho ou equipe não aceita nunca gera sucesso nem confirmação', async () => {
  for (const send of [
    async () => { throw new Error('SMTP failure with confidential provider details'); },
    async () => ({ accepted: [], rejected: [env.CONTACT_TEAM_EMAIL] }),
    async () => ({ accepted: ['different@example.test'], rejected: [] }),
    async () => ({ accepted: [env.CONTACT_TEAM_EMAIL], rejected: [env.CONTACT_TEAM_EMAIL] }),
  ]) {
    let calls = 0;
    const transport = { async sendMail(message) { calls++; return send(message); } };
    const contact = service({ transport });
    const data = payload();
    const first = await contact.submit(data);
    const repeated = await contact.submit(data);
    assert.equal(first.status, 503);
    assert.equal(first.body.ok, false);
    assert.deepEqual(first, repeated);
    assert.equal(calls, 1, 'mesmo requestId não repete tentativa SMTP ambígua');
    assert.doesNotMatch(JSON.stringify(first), /confidential|example\.test|fixture/);
  }
});

test('falha só na confirmação retorna sucesso e repetição não duplica o lead', async () => {
  let calls = 0;
  const contact = service({ transport: { async sendMail(message) { calls++; if (calls === 1) return { accepted: [message.to] }; throw new Error('confirmation failed'); } } });
  const data = payload();
  assert.deepEqual(await contact.submit(data), { status: 200, body: { ok: true, acknowledgementSent: false } });
  assert.deepEqual(await contact.submit(data), { status: 200, body: { ok: true, acknowledgementSent: false } });
  assert.equal(calls, 2);
});

test('idempotência agrupa envios simultâneos e rejeita UUID reutilizado com dados diferentes', async () => {
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const contact = service({ transport: { async sendMail(message) { calls++; if (calls === 1) await gate; return { accepted: [message.to] }; } } });
  const data = payload();
  const first = contact.submit(data, { ip: '192.0.2.1' });
  const duplicate = contact.submit({ ...data }, { ip: '192.0.2.2' });
  assert.equal(calls, 1);
  assert.equal((await contact.submit({ ...data, cidade: 'Outra cidade' })).status, 409);
  release();
  assert.deepEqual(await first, await duplicate);
  assert.equal(calls, 2);
});

test('limite por IP inclui inválidos, respeita janela e não bloqueia repetição idempotente', async () => {
  let time = 10_000;
  const transport = recordingTransport();
  const contact = service({ transport, now: () => time, rateLimit: 2, rateWindowMs: 1000 });
  const first = payload();
  assert.equal((await contact.submit(first, { ip: '192.0.2.1' })).status, 200);
  assert.equal((await contact.submit(payload({ privacidade: false }), { ip: '192.0.2.1' })).status, 400);
  assert.equal((await contact.submit(payload(), { ip: '192.0.2.1' })).status, 429);
  assert.equal((await contact.submit(first, { ip: '192.0.2.1' })).status, 200);
  assert.equal((await contact.submit(payload(), { ip: '192.0.2.2' })).status, 200);
  time += 1001;
  assert.equal((await contact.submit(payload(), { ip: '192.0.2.1' })).status, 200);
  assert.equal(transport.messages.length, 6);
});

test('cache tem capacidade e expiração sem reenvio durante a janela', async () => {
  let time = 10_000;
  const transport = recordingTransport();
  const contact = service({ transport, now: () => time, cacheTtlMs: 100, maxEntries: 1, rateWindowMs: 100, rateLimit: 10 });
  const first = payload();
  assert.equal((await contact.submit(first)).status, 200);
  assert.equal((await contact.submit(payload())).status, 503);
  assert.equal((await contact.submit(first)).status, 200);
  time += 101;
  assert.equal((await contact.submit(payload())).status, 200);
  assert.equal(transport.messages.length, 4);
});

async function withHttp(contact, run) {
  const server = http.createServer(async (req, res) => {
    if (!(await contact.handle(req, res))) res.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('HTTP valida origem, método, formato e JSON sem expor detalhes internos', async () => {
  const transport = recordingTransport();
  await withHttp(service({ transport }), async base => {
    const post = (body, headers = {}) => fetch(`${base}/api/conversa`, { method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', ...headers }, body });
    assert.equal((await fetch(`${base}/other`)).status, 404);
    const method = await fetch(`${base}/api/conversa`);
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'POST');
    assert.equal((await post(JSON.stringify(payload()), { Origin: 'https://attacker.test' })).status, 403);
    assert.equal((await post(JSON.stringify(payload()), { Origin: '' })).status, 403);
    assert.equal((await post(JSON.stringify(payload()), { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(JSON.stringify(payload()), { 'Content-Encoding': 'gzip' })).status, 415);
    assert.equal((await post('{malformed')).status, 400);
    const result = await post(JSON.stringify(payload()));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await result.json(), { ok: true, acknowledgementSent: true });
    assert.equal(transport.messages.length, 2);
  });
});

test('HTTP desativado retorna 503; não processa nem envia formulário', async () => {
  const transport = recordingTransport();
  await withHttp(service({ enabled: false, transport }), async base => {
    const result = await fetch(`${base}/api/conversa`, { method: 'POST', body: JSON.stringify(payload()) });
    assert.equal(result.status, 503);
    assert.equal((await result.json()).ok, false);
  });
  assert.equal(transport.messages.length, 0);
});

test('HTTP limita corpo declarado e chunked a 16 KiB sem enviar e-mail', async () => {
  const transport = recordingTransport();
  await withHttp(service({ transport }), async base => {
    const body = JSON.stringify(payload({ cidade: 'x'.repeat(MAX_BODY_BYTES) }));
    const headers = { Origin: 'https://example.test', 'Content-Type': 'application/json' };
    const result = await fetch(`${base}/api/conversa`, { method: 'POST', headers, body });
    assert.equal(result.status, 413);
    const chunked = await new Promise((resolve, reject) => {
      const request = http.request(`${base}/api/conversa`, { method: 'POST', headers }, response => {
        let data = ''; response.setEncoding('utf8'); response.on('data', chunk => { data += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data) }));
      });
      request.on('error', reject);
      request.write(body.slice(0, 8000)); request.write(body.slice(8000)); request.end();
    });
    assert.equal(chunked.status, 413);
    assert.equal(chunked.body.ok, false);
  });
  assert.equal(transport.messages.length, 0);
});
