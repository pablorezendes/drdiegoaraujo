import { createHmac, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';

export const MAX_BODY_BYTES = 16 * 1024;
export const ACKNOWLEDGEMENT = 'Recebido. Retornamos em até 2 dias úteis para marcar uma conversa. O envio não garante vaga.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/u;
const FIELDS = new Set(['requestId', 'para', 'interesse', 'origem', 'indicacao', 'cidade', 'valor', 'nome', 'email', 'whatsapp', 'horario', 'privacidade', 'comunicacoes', 'site']);
const unavailable = () => ({ status: 503, body: { ok: false, message: 'O envio está indisponível no momento. Tente novamente mais tarde.' } });
const invalid = () => ({ status: 400, body: { ok: false, message: 'Revise os campos e o aceite de privacidade antes de enviar.' } });

function text(value, limit, optional = false) {
  if (typeof value !== 'string' || CONTROLS.test(value)) throw new Error('invalid');
  const normalized = value.normalize('NFC').trim();
  if ((!optional && !normalized) || [...normalized].length > limit) throw new Error('invalid');
  return normalized;
}

function email(value) {
  const address = text(value, 254);
  const pieces = address.split('@');
  if (pieces.length !== 2) throw new Error('invalid');
  const [local, domain] = pieces;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) throw new Error('invalid');
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error('invalid');
  return `${local}@${domain.toLowerCase()}`;
}

function choice(value, allowed) {
  if (!allowed.includes(value)) throw new Error('invalid');
  return value;
}

export function validateContactPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(key => !FIELDS.has(key))) throw new Error('invalid');
  if (typeof payload.requestId !== 'string' || !UUID.test(payload.requestId)) throw new Error('invalid');
  if (payload.privacidade !== true || typeof payload.comunicacoes !== 'boolean' || payload.site !== '') throw new Error('invalid');
  if (typeof payload.whatsapp !== 'string' || !/^\d{10,15}$/.test(payload.whatsapp)) throw new Error('invalid');
  return {
    requestId: payload.requestId.toLowerCase(),
    para: choice(payload.para, ['mim', 'proximo', 'presente']),
    interesse: choice(payload.interesse, ['corpo', 'mente', 'espiritual', 'inteiro']),
    origem: choice(payload.origem, ['indicacao', 'outro']),
    indicacao: text(payload.indicacao === undefined ? '' : payload.indicacao, 120, true),
    cidade: text(payload.cidade, 120),
    valor: choice(payload.valor, ['sim', 'entender']),
    nome: text(payload.nome, 160),
    email: email(payload.email),
    whatsapp: payload.whatsapp,
    horario: choice(payload.horario, ['manha', 'tarde', 'noite']),
    privacidade: true,
    comunicacoes: payload.comunicacoes,
    site: '',
  };
}

function configuration(env) {
  try {
    const origins = (env.CONTACT_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!origins.length) return null;
    for (const origin of origins) {
      const url = new URL(origin);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.origin !== origin || !(url.protocol === 'https:' || (local && url.protocol === 'http:'))) return null;
    }
    const port = Number(env.SMTP_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !['true', 'false'].includes(env.SMTP_SECURE)) return null;
    const host = text(env.SMTP_HOST, 253);
    const user = text(env.SMTP_USER, 320);
    if (!env.SMTP_PASS || typeof env.SMTP_PASS !== 'string') return null;
    const privacyVersion = text(env.CONTACT_PRIVACY_VERSION, 80);
    return { origins: new Set(origins), port, host, user, password: env.SMTP_PASS, secure: env.SMTP_SECURE === 'true', from: email(env.SMTP_FROM), team: email(env.CONTACT_TEAM_EMAIL), privacyVersion };
  } catch { return null; }
}

function accepted(info, address) {
  const matches = value => (typeof value === 'string' ? value : value?.address)?.toLowerCase() === address.toLowerCase();
  return Array.isArray(info?.accepted) && info.accepted.some(matches) && !info.rejected?.some(matches);
}

function teamMessage(data, receivedAt, privacyVersion) {
  return [
    'Nova pré-solicitação de conversa — NOÉRION',
    `Identificador: ${data.requestId}`,
    `Recebida em (UTC): ${receivedAt}`,
    '',
    `Para quem: ${data.para}`,
    `Interesse: ${data.interesse}`,
    `Origem: ${data.origem}`,
    `Indicação (opcional): ${data.indicacao || 'Não informada'}`,
    `Cidade: ${data.cidade}`,
    `Sobre os honorários: ${data.valor}`,
    `Nome: ${data.nome}`,
    `E-mail: ${data.email}`,
    `WhatsApp: ${data.whatsapp}`,
    `Melhor horário: ${data.horario}`,
    '',
    `Política de privacidade: ${privacyVersion}`,
    `Leitura/aceite de privacidade declarado em (UTC): ${receivedAt}`,
    `Comunicações opcionais: ${data.comunicacoes ? 'Sim' : 'Não'}`,
    `Registro da escolha de comunicações (UTC): ${receivedAt}`,
    '',
    'Solicitação de contato; o envio não garante vaga. Não foram solicitadas informações de saúde.',
  ].join('\n');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    const finish = (error, value) => {
      clearTimeout(timer);
      req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAborted);
      if (error) { req.once('error', () => {}); req.resume(); reject(error); } else resolve(value);
    };
    const onData = chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_BODY_BYTES) { finish({ status: 413 }); return; }
      chunks.push(buffer);
    };
    const onEnd = () => {
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { finish({ status: 400 }); }
    };
    const onError = () => finish({ status: 400 });
    const onAborted = () => finish({ status: 400 });
    const timer = setTimeout(() => finish({ status: 408 }), 10_000);
    timer.unref?.();
    req.on('data', onData); req.once('end', onEnd); req.once('error', onError); req.once('aborted', onAborted);
  });
}

function respond(res, result) {
  const body = JSON.stringify(result.body);
  res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...result.headers });
  res.end(body);
}

/** Inativo por padrão: exige enabled:true no código E CONTACT_ENABLED=true no ambiente. */
export function createContactService({ enabled = false, env = process.env, transport, now = Date.now, getClientIp = req => req.socket?.remoteAddress || 'unknown', rateLimit = 5, rateWindowMs = 10 * 60_000, cacheTtlMs = 10 * 60_000, maxEntries = 1000 } = {}) {
  const config = configuration(env);
  const active = enabled === true && env.CONTACT_ENABLED === 'true' && config !== null;
  const key = randomBytes(32);
  const digest = value => createHmac('sha256', key).update(value).digest('hex');
  const rateEntries = new Map();
  const requests = new Map();
  let mailTransport = transport;

  function sweep(time) {
    for (const [id, entry] of requests) if (entry.expiresAt <= time && !entry.pending) requests.delete(id);
    for (const [id, entry] of rateEntries) if (entry.expiresAt <= time) rateEntries.delete(id);
  }

  function allow(ip, time) {
    const id = digest(String(ip));
    let entry = rateEntries.get(id);
    if (!entry) {
      if (rateEntries.size >= maxEntries) return false;
      entry = { count: 0, expiresAt: time + rateWindowMs };
      rateEntries.set(id, entry);
    }
    entry.count += 1;
    return entry.count <= rateLimit;
  }

  async function deliver(data, time) {
    try {
      if (!mailTransport) mailTransport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, requireTLS: true, auth: { user: config.user, pass: config.password }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000, logger: false, debug: false });
      const envelope = { from: { name: 'NOÉRION', address: config.from }, disableFileAccess: true, disableUrlAccess: true };
      const domain = config.from.split('@')[1];
      const receipt = await mailTransport.sendMail({ ...envelope, to: config.team, replyTo: { address: data.email }, subject: 'Nova solicitação de conversa — NOÉRION', text: teamMessage(data, new Date(time).toISOString(), config.privacyVersion), messageId: `<${data.requestId}.team@${domain}>` });
      if (!accepted(receipt, config.team)) return unavailable();
      let acknowledgementSent = false;
      try {
        const acknowledgement = await mailTransport.sendMail({ ...envelope, to: data.email, subject: 'Recebemos a sua solicitação', text: `Olá, ${data.nome}. Recebemos a sua solicitação de conversa. Em até 2 dias úteis, entramos em contato para marcar o melhor horário.\nDr. Diego de Araújo · NOÉRION`, messageId: `<${data.requestId}.confirmation@${domain}>` });
        acknowledgementSent = accepted(acknowledgement, data.email);
      } catch { /* A equipe já recebeu. Não reenvie a solicitação por falha da confirmação. */ }
      return { status: 200, body: { ok: true, acknowledgementSent } };
    } catch { return unavailable(); }
  }

  async function submit(payload, { ip = 'unknown' } = {}) {
    if (!active) return unavailable();
    const time = now();
    sweep(time);
    let data;
    try {
      if (Buffer.byteLength(JSON.stringify(payload)) > MAX_BODY_BYTES) return { status: 413, body: { ok: false, message: 'O envio excede o tamanho permitido.' } };
      data = validateContactPayload(payload);
    } catch {
      if (!allow(ip, time)) return { status: 429, headers: { 'Retry-After': String(Math.ceil(rateWindowMs / 1000)) }, body: { ok: false, message: 'Aguarde alguns minutos antes de tentar novamente.' } };
      return invalid();
    }
    const fingerprint = digest(JSON.stringify(data));
    const previous = requests.get(data.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) return { status: 409, body: { ok: false, message: 'Este envio já foi usado com outros dados. Revise e inicie uma nova solicitação.' } };
      return previous.promise;
    }
    if (!allow(ip, time)) return { status: 429, headers: { 'Retry-After': String(Math.ceil(rateWindowMs / 1000)) }, body: { ok: false, message: 'Aguarde alguns minutos antes de tentar novamente.' } };
    if (requests.size >= maxEntries) return unavailable();
    const entry = { fingerprint, expiresAt: time + cacheTtlMs, pending: true, promise: null };
    // O cache guarda apenas HMAC, identificador, resultado e promessa; não armazena o formulário.
    entry.promise = deliver(data, time).then(result => { entry.pending = false; entry.expiresAt = now() + cacheTtlMs; return result; });
    requests.set(data.requestId, entry);
    return entry.promise;
  }

  async function handle(req, res) {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { return false; }
    if (pathname !== '/api/conversa') return false;
    if (req.method !== 'POST') { req.resume(); respond(res, { status: 405, headers: { Allow: 'POST' }, body: { ok: false, message: 'Use POST para enviar a solicitação.' } }); return true; }
    if (!active) { req.resume(); respond(res, unavailable()); return true; }
    if (typeof req.headers.origin !== 'string' || !config.origins.has(req.headers.origin)) { req.resume(); respond(res, { status: 403, body: { ok: false, message: 'Origem do envio não permitida.' } }); return true; }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') || (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) { req.resume(); respond(res, { status: 415, body: { ok: false, message: 'Envie os dados no formato JSON.' } }); return true; }
    if (req.headers['content-length'] && (!/^\d+$/.test(req.headers['content-length']) || Number(req.headers['content-length']) > MAX_BODY_BYTES)) { req.resume(); respond(res, { status: 413, body: { ok: false, message: 'O envio excede o tamanho permitido.' } }); return true; }
    try {
      respond(res, await submit(await readJson(req), { ip: getClientIp(req) }));
    } catch (error) {
      const status = [400, 408, 413].includes(error?.status) ? error.status : 503;
      respond(res, { status, body: { ok: false, message: status === 413 ? 'O envio excede o tamanho permitido.' : status === 503 ? unavailable().body.message : 'Não foi possível ler o envio. Revise os dados e tente novamente.' } });
    }
    return true;
  }

  return Object.freeze({ handle, submit, enabled: active });
}
