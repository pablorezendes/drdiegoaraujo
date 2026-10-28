import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/conversa.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../dist/conversa.html', import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Adaptador mínimo de DOM para testar transições e transporte sem navegador,
// servidor, requisições de rede ou acesso a dados reais. Não substitui QA visual.
function fixture(configuration = {}) {
  const nodes = new Map();
  const fields = [];
  class Element {
    constructor(id, options = {}) {
      Object.assign(this, {
        id, hidden: false, disabled: false, type: '', name: '', value: '',
        checked: false, required: false, custom: '', attributes: {}, events: {},
        children: [], textContent: '',
      }, options);
      if (id) nodes.set(id, this);
    }
    addEventListener(type, callback) { (this.events[type] ||= []).push(callback); }
    fire(type, event = {}) {
      event.target ||= this;
      event.preventDefault ||= () => {};
      (this.events[type] || []).forEach((callback) => callback(event));
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    setCustomValidity(value) { this.custom = value; }
    focus() { document.activeElement = this; }
    reportValidity() { return this.validity.valid; }
    querySelectorAll() { return this.children; }
    querySelector() { return this.children.find((child) => child.name !== 'site'); }
    closest() { return null; }
    get willValidate() { return !this.disabled && this.name !== 'site'; }
    get validationMessage() { return this.custom; }
    get validity() {
      return { valid: !this.custom && (!this.required || (this.type === 'radio' || this.type === 'checkbox' ? this.checked : Boolean(this.value))) };
    }
  }
  const form = new Element('conversation-form');
  const first = new Element('passo1');
  const second = new Element('passo2');
  ['recebido', 'etapa', 'etapa-n', 'form-error', 'contact-state', 'continuar', 'voltar', 'enviar', 'de-novo'].forEach((id) => new Element(id));
  nodes.get('enviar').disabled = true;
  function input(name, container, value, type = 'text', required = true) {
    const field = new Element(name, { name, value, type, required, checked: type === 'radio' || name === 'privacidade' });
    fields.push(field);
    container.children.push(field);
    return field;
  }
  input('para', first, 'mim', 'radio');
  input('interesse', first, 'corpo', 'radio');
  input('origem', first, 'outro', 'radio');
  input('indicacao', first, '', 'text', false);
  input('cidade', first, 'Cidade de teste / UF');
  input('valor', first, 'sim', 'radio');
  input('nome', second, 'Pessoa de Teste');
  input('email', second, 'pessoa@example.test');
  input('whatsapp', second, '11987654321', 'tel');
  input('horario', second, 'manha', 'select');
  input('site', second, '', 'text', false);
  input('privacidade', second, 'on', 'checkbox');
  input('comunicacoes', second, 'on', 'checkbox', false);
  form.elements = [...fields, first, second, nodes.get('continuar'), nodes.get('voltar'), nodes.get('enviar')];
  const document = { readyState: 'complete', getElementById: (id) => nodes.get(id), activeElement: null };
  const timers = new Map();
  let timerId = 0;
  const calls = [];
  const window = {
    NOERION_CONFIG: { contactEnabled: true, legalApproved: true, contactEndpoint: '/api/conversa', ...configuration },
    crypto: webcrypto,
    location: { href: 'https://drdiegoaraujo.com/conversa', origin: 'https://drdiegoaraujo.com' },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener() {},
  };
  let responder = async () => ({ ok: true, json: async () => ({ ok: true }) });
  const fetch = (url, options) => {
    calls.push({ url, options, payload: JSON.parse(options.body) });
    return responder(url, options);
  };
  class FormData {
    constructor() {
      this.data = new Map(fields
        .filter((field) => !field.disabled && (!['radio', 'checkbox'].includes(field.type) || field.checked))
        .map((field) => [field.name, field.value]));
    }
    get(name) { return this.data.get(name); }
    has(name) { return this.data.has(name); }
  }
  vm.runInNewContext(source, { document, window, FormData, fetch, URL, AbortController, Uint8Array });
  return { nodes, fields, form, first, second, calls, timers, window, responder: (fn) => { responder = fn; } };
}

test('sem JavaScript o envio nasce desabilitado, consentimentos independentes e sem marketing marcado', () => {
  const sendButton = html.match(/<button\b(?=[^>]*\bid="enviar")[^>]*>/s)?.[0];
  assert.ok(sendButton);
  assert.match(sendButton, /\bdisabled\b/);
  assert.match(html, /<noscript>/);
  const marketing = html.match(/<input\b(?=[^>]*\bname="comunicacoes")[^>]*>/s)?.[0];
  const privacy = html.match(/<input\b(?=[^>]*\bname="privacidade")[^>]*>/s)?.[0];
  assert.doesNotMatch(marketing, /\bchecked\b|\brequired\b/);
  assert.match(privacy, /\brequired\b/);
  assert.match(html, /name="nome"[^>]*maxlength="160"/);
  assert.match(html, /name="cidade"[^>]*maxlength="120"/);
  assert.match(html, /name="indicacao"[^>]*maxlength="120"/);
  assert.match(html, /name="email"[^>]*maxlength="254"/);
});

test('envio exige habilitação de contato e aprovação jurídica, sem fetch enquanto bloqueado', async () => {
  for (const configuration of [
    { contactEnabled: false, legalApproved: false },
    { contactEnabled: false, legalApproved: true },
    { contactEnabled: true, legalApproved: false },
  ]) {
    const page = fixture(configuration);
    page.nodes.get('continuar').fire('click');
    page.form.fire('submit');
    await tick();
    assert.equal(page.calls.length, 0);
    assert.equal(page.nodes.get('enviar').disabled, true);
    assert.equal(page.nodes.get('contact-state').hidden, false);
    assert.match(page.nodes.get('form-error').textContent, /ainda não está disponível/);
  }
});

test('cidade obrigatória impede avanço e recebe foco', () => {
  const page = fixture();
  page.nodes.get('cidade').value = '   ';
  page.nodes.get('continuar').fire('click');
  assert.equal(page.first.hidden, false);
  assert.match(page.nodes.get('form-error').textContent, /cidade/);
  assert.equal(page.nodes.get('cidade').attributes['aria-invalid'], 'true');
});

test('Enter avança e voltar mantém valores; Enter final envia', async () => {
  const page = fixture();
  page.form.fire('keydown', { key: 'Enter', target: page.nodes.get('cidade') });
  assert.equal(page.second.hidden, false);
  page.nodes.get('voltar').fire('click');
  assert.equal(page.nodes.get('cidade').value, 'Cidade de teste / UF');
  page.nodes.get('continuar').fire('click');
  page.form.fire('keydown', { key: 'Enter', target: page.nodes.get('email') });
  await tick();
  assert.equal(page.calls.length, 1);
  assert.equal(page.nodes.get('recebido').hidden, false);
});

test('somente HTTP ok E JSON ok booleano verdadeiro exibem Recebido', async (t) => {
  const cases = [
    ['HTTP falho mesmo com ok:true', false, { ok: true }],
    ['ok:false', true, { ok: false }],
    ['ok ausente', true, {}],
    ['ok string', true, { ok: 'true' }],
    ['ok numérico', true, { ok: 1 }],
    ['JSON nulo', true, null],
    ['JSON inválido', true, undefined],
  ];
  for (const [name, httpOk, body] of cases) {
    await t.test(name, async () => {
      const page = fixture();
      page.nodes.get('continuar').fire('click');
      page.responder(async () => ({ ok: httpOk, json: async () => { if (body === undefined) throw new SyntaxError(); return body; } }));
      page.form.fire('submit');
      await tick();
      assert.equal(page.nodes.get('recebido').hidden, true);
      assert.equal(page.form.hidden, false);
      assert.equal(page.nodes.get('nome').value, 'Pessoa de Teste');
      assert.ok(page.nodes.get('form-error').textContent);
      assert.equal(page.nodes.get('enviar').disabled, false);
    });
  }
});

test('mensagem de erro do servidor é texto literal, preserva valores e permite tentar novamente', async () => {
  const page = fixture();
  page.nodes.get('continuar').fire('click');
  page.responder(async () => ({ ok: false, json: async () => ({ ok: false, message: '<b>Revise os campos.</b>' }) }));
  page.form.fire('submit');
  await tick();
  assert.equal(page.nodes.get('form-error').textContent, '<b>Revise os campos.</b>');
  assert.equal(page.nodes.get('nome').value, 'Pessoa de Teste');
  assert.equal(page.nodes.get('enviar').disabled, false);
});

test('UUID é estável em retry idêntico e muda quando o payload muda', async () => {
  const page = fixture();
  page.nodes.get('continuar').fire('click');
  page.responder(async () => ({ ok: false, json: async () => ({ ok: false }) }));
  page.form.fire('submit');
  await tick();
  const id = page.calls[0].payload.requestId;
  assert.match(id, /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
  page.form.fire('submit');
  await tick();
  assert.equal(page.calls[1].payload.requestId, id);
  page.nodes.get('nome').value = 'Outra Pessoa';
  page.form.fire('submit');
  await tick();
  assert.notEqual(page.calls[2].payload.requestId, id);
});

test('WhatsApp formatado é normalizado antes do payload e do fingerprint', async () => {
  const page = fixture();
  page.nodes.get('whatsapp').value = '+55 (61) 99999-9999';
  page.nodes.get('continuar').fire('click');
  page.responder(async () => ({ ok: false, json: async () => ({ ok: false }) }));
  page.form.fire('submit');
  await tick();
  assert.equal(page.calls[0].payload.whatsapp, '5561999999999');
  page.nodes.get('whatsapp').value = '5561999999999';
  page.form.fire('submit');
  await tick();
  assert.equal(page.calls[1].payload.requestId, page.calls[0].payload.requestId);
});

test('limites e formatos do frontend correspondem aos limites da API', async (t) => {
  for (const [field, value] of [
    ['nome', 'A'.repeat(161)], ['cidade', 'A'.repeat(121)], ['indicacao', 'A'.repeat(121)],
    ['email', 'a..b@example.test'], ['email', 'x@-invalid.test'], ['email', 'a'.repeat(65) + '@example.test'],
    ['whatsapp', '123456789'], ['whatsapp', '1'.repeat(16)], ['whatsapp', 'abc11987654321'],
  ]) {
    await t.test(`${field}: ${value.slice(0, 20)}`, async () => {
      const page = fixture();
      page.nodes.get(field).value = value;
      page.nodes.get('continuar').fire('click');
      page.form.fire('submit');
      await tick();
      assert.equal(page.calls.length, 0);
      assert.ok(page.nodes.get('form-error').textContent);
    });
  }
  const valid = fixture();
  valid.nodes.get('nome').value = 'A'.repeat(160);
  valid.nodes.get('cidade').value = 'B'.repeat(120);
  valid.nodes.get('indicacao').value = 'C'.repeat(120);
  valid.nodes.get('continuar').fire('click');
  valid.form.fire('submit');
  await tick();
  assert.equal(valid.calls.length, 1);
});

test('honeypot é enviado bruto para rejeição no servidor, inclusive espaços', async () => {
  const page = fixture();
  page.nodes.get('site').value = '  ';
  page.nodes.get('continuar').fire('click');
  page.responder(async () => ({ ok: false, json: async () => ({ ok: false }) }));
  page.form.fire('submit');
  await tick();
  assert.equal(page.calls[0].payload.site, '  ');
  assert.equal(page.nodes.get('recebido').hidden, true);
});

test('sucesso confirmado mantém opt-in opcional independente e permite rever dados', async () => {
  const page = fixture();
  page.nodes.get('continuar').fire('click');
  page.responder(async () => ({ ok: true, json: async () => ({ ok: true, acknowledgementSent: false }) }));
  page.form.fire('submit');
  await tick();
  assert.equal(page.nodes.get('recebido').hidden, false);
  assert.equal(page.form.hidden, true);
  assert.equal(page.calls[0].payload.privacidade, true);
  assert.equal(page.calls[0].payload.comunicacoes, false);
  page.nodes.get('de-novo').fire('click');
  assert.equal(page.first.hidden, false);
  assert.equal(page.nodes.get('nome').value, 'Pessoa de Teste');
});

test('dupla submissão não duplica fetch e controles ficam indisponíveis durante o envio', async () => {
  const page = fixture();
  page.nodes.get('continuar').fire('click');
  let release;
  page.responder(() => new Promise((resolve) => { release = resolve; }));
  page.form.fire('submit');
  page.form.fire('submit');
  assert.equal(page.calls.length, 1);
  assert.equal(page.nodes.get('enviar').disabled, true);
  assert.equal(page.nodes.get('voltar').disabled, true);
  assert.equal(page.form.attributes['aria-busy'], 'true');
  release({ ok: true, json: async () => ({ ok: true }) });
  await tick();
  assert.equal(page.form.attributes['aria-busy'], undefined);
});

test('timeout de 15 segundos aborta, preserva dados e reabilita tentativa manual', async () => {
  const page = fixture();
  page.nodes.get('continuar').fire('click');
  page.responder((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
    const problem = new Error('abort'); problem.name = 'AbortError'; reject(problem);
  })));
  page.form.fire('submit');
  const timer = [...page.timers.values()].find((item) => item.ms === 15000);
  assert.ok(timer);
  timer.fn();
  await tick();
  assert.match(page.nodes.get('form-error').textContent, /demorou mais/);
  assert.equal(page.nodes.get('recebido').hidden, true);
  assert.equal(page.nodes.get('nome').value, 'Pessoa de Teste');
  assert.equal(page.nodes.get('enviar').disabled, false);
});

test('privacidade é obrigatória e URL de envio deve ter a mesma origem', async () => {
  const page = fixture();
  page.nodes.get('privacidade').checked = false;
  page.nodes.get('continuar').fire('click');
  page.form.fire('submit');
  await tick();
  assert.equal(page.calls.length, 0);
  assert.match(page.nodes.get('form-error').textContent, /Política/);
  const external = fixture({ contactEndpoint: 'https://outro.example.test/api/conversa' });
  external.nodes.get('continuar').fire('click');
  external.form.fire('submit');
  await tick();
  assert.equal(external.calls.length, 0);
});

function contactFixture(config) {
  class Element {
    constructor(type) { this.dataset = { contact: type }; this.hidden = true; this.classList = { add: () => { this.visible = true; } }; }
    removeAttribute(name) { delete this[name]; }
  }
  const whatsapp = new Element('whatsapp');
  const email = new Element('email');
  const reveal = new Element();
  const pending = new Element();
  const group = { hidden: false, querySelector: () => [whatsapp, email].find((link) => !link.hidden) };
  const elements = { '[data-contact]': [whatsapp, email], '[data-contact-pending]': [pending], '[data-contact-group]': [group], '.reveal': [reveal] };
  const document = {
    readyState: 'complete', querySelectorAll: (selector) => elements[selector] || [],
    getElementById: () => null, querySelector: () => null,
    documentElement: { classList: { remove() {}, add() { throw new Error('Não deve esconder conteúdo sem IO.'); } } },
  };
  const window = { NOERION_CONFIG: config, matchMedia: () => ({ matches: true }) };
  vm.runInNewContext(appSource, { document, window });
  return { whatsapp, email, pending, group, reveal };
}

test('canais vazios/placeholders ficam ocultos; canais válidos usam mensagem WhatsApp exata', () => {
  for (const config of [{}, { whatsapp: '5500000000000', email: 'pessoa@example.com' }]) {
    const page = contactFixture(config);
    assert.equal(page.whatsapp.hidden, true);
    assert.equal(page.email.hidden, true);
    assert.equal(page.whatsapp.href, undefined);
    assert.equal(page.group.hidden, true);
    assert.equal(page.reveal.visible, true);
  }
  const page = contactFixture({ whatsapp: '5511987654321', email: 'profissional@dominioconfirmado.com.br' });
  assert.equal(page.whatsapp.hidden, false);
  assert.equal(new URL(page.whatsapp.href).searchParams.get('text'), 'Olá. Gostaria de solicitar uma conversa sobre o NOÉRION.');
  assert.equal(page.whatsapp.rel, 'noopener noreferrer');
  assert.equal(page.email.href, 'mailto:profissional@dominioconfirmado.com.br');
  assert.equal(page.pending.hidden, true);
});

test('páginas preservam metadados de bloqueio, URLs limpas, fontes e ausência de código inline', () => {
  for (const page of ['conversa', 'privacidade', 'termos']) {
    const content = readFileSync(new URL(`../dist/${page}.html`, import.meta.url), 'utf8');
    assert.match(content, /name="robots" content="noindex, nofollow, noarchive"/);
    assert.ok(content.includes(`href="https://drdiegoaraujo.com/${page}"`));
    assert.match(content, /property="og:image" content="https:\/\/drdiegoaraujo.com\/img\/og-image.png"/);
    assert.match(content, /family=EB\+Garamond/);
    assert.match(content, /family=Hanken\+Grotesk/);
    assert.doesNotMatch(content, /\sstyle=|<style\b|<script>/);
    assert.doesNotMatch(content, /class="mobile-menu"|data-menu-toggle/);
    if (page !== 'conversa') {
      assert.match(content, /Minuta para revisão jurídica — texto em revisão/);
      assert.match(content, /O formulário de contato permanece desativado/);
    }
  }
});
