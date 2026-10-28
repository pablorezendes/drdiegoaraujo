/* Medição preparada para o lançamento. Nunca lê os campos do formulário. */
(() => {
  'use strict';
  const config = window.NOERION_CONFIG || {};
  const analytics = config.analytics || {};
  const publicHosts = ['drdiegoaraujo.com', 'www.drdiegoaraujo.com'];
  if (analytics.enabled !== true || config.legalApproved !== true
    || window.location.protocol !== 'https:' || !publicHosts.includes(window.location.hostname)) return;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(analytics.websiteId || '')) return;
  let source;
  try { source = new URL(analytics.scriptUrl); } catch { return; }
  if (source.protocol !== 'https:' || source.username || source.password || source.search || source.hash
    || !source.pathname.endsWith('/script.js')) return;
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;

  // Umami: coleta só visualizações de páginas conhecidas, sem query, hash, referrer ou eventos.
  // Contrato oficial: https://docs.umami.is/docs/tracker-configuration
  window.noerionBeforeAnalytics = (type, payload) => {
    if (type !== 'event' || !payload || payload.name || payload.data) return false;
    const page = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    if (!['/', '/conversa', '/privacidade', '/termos'].includes(page)) return false;
    return {
      website: analytics.websiteId,
      hostname: window.location.hostname,
      url: page,
      title: document.title,
      language: document.documentElement.lang,
      screen: payload.screen
    };
  };
  const script = document.createElement('script');
  script.defer = true;
  script.src = source.href;
  script.dataset.websiteId = analytics.websiteId;
  script.dataset.domains = publicHosts.join(',');
  script.dataset.excludeSearch = 'true';
  script.dataset.excludeHash = 'true';
  script.dataset.doNotTrack = 'true';
  script.dataset.beforeSend = 'noerionBeforeAnalytics';
  script.referrerPolicy = 'no-referrer';
  document.head.append(script);
})();
