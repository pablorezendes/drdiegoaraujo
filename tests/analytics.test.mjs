import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/analytics.js', import.meta.url), 'utf8');
const websiteId = '94db1cb1-74f4-4a40-ad6c-962362670409';
const configuration = () => ({ legalApproved: true, analytics: { enabled: true, scriptUrl: 'https://stats.example.test/script.js', websiteId } });
function run(config = configuration(), options = {}) {
  const scripts = [];
  const window = {
    NOERION_CONFIG: config,
    location: { protocol: 'https:', hostname: 'drdiegoaraujo.com', pathname: '/conversa', ...options.location }
  };
  vm.runInNewContext(source, {
    window, URL,
    navigator: { ...options.navigator },
    document: {
      title: 'Solicitar uma conversa · NOÉRION', documentElement: { lang: 'pt-BR' },
      createElement: () => ({ dataset: {} }), head: { append: element => scripts.push(element) }
    }
  });
  return { scripts, window };
}
test('medição fica desativada sem habilitação e aprovação, sem script nem rede', () => {
  for (const config of [{}, { ...configuration(), legalApproved: false }, { ...configuration(), analytics: { enabled: false } }]) assert.equal(run(config).scripts.length, 0);
});
test('não carrega medição em arquivo/local, por HTTP, com destino inválido ou preferência de privacidade', () => {
  for (const options of [{ location: { hostname: 'localhost' } }, { location: { protocol: 'http:' } }, { navigator: { doNotTrack: '1' } }, { navigator: { globalPrivacyControl: true } }]) assert.equal(run(configuration(), options).scripts.length, 0);
  for (const analytics of [{ enabled: true, scriptUrl: 'http://stats.example.test/script.js', websiteId }, { enabled: true, scriptUrl: 'https://stats.example.test/script.js?user=example', websiteId }, { enabled: true, scriptUrl: 'https://stats.example.test/script.js', websiteId: '' }]) assert.equal(run({ legalApproved: true, analytics }).scripts.length, 0);
});
test('medição preparada sem cookies exclui query/hash e não envia eventos, formulário, referrer ou identidade', () => {
  const { scripts, window } = run();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].dataset.excludeSearch, 'true');
  assert.equal(scripts[0].dataset.excludeHash, 'true');
  assert.equal(scripts[0].referrerPolicy, 'no-referrer');
  const sanitize = window.noerionBeforeAnalytics;
  assert.equal(sanitize('identify', {}), false);
  assert.equal(sanitize('event', { name: 'contato', data: { email: 'pessoa@example.test' } }), false);
  const result = sanitize('event', { url: '/conversa?email=pessoa@example.test#nome', referrer: 'https://external.example.test/', id: 'pessoa', screen: '1280x720' });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { website: websiteId, hostname: 'drdiegoaraujo.com', url: '/conversa', title: 'Solicitar uma conversa · NOÉRION', language: 'pt-BR', screen: '1280x720' });
  window.location.pathname = '/rota-desconhecida';
  assert.equal(sanitize('event', {}), false);
});
