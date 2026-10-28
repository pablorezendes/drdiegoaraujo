(() => {
  'use strict';

  const init = () => {
    const all = (selector) => [...document.querySelectorAll(selector)];
    const config = window.NOERION_CONFIG || {};
    const motion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };

    all('[data-year]').forEach((element) => { element.textContent = String(new Date().getFullYear()); });
    all('[data-registration]').forEach((element) => {
      element.textContent = String(config.registration || 'CREFITO-11/362668-F');
    });
    all('[data-secondary-registration]').forEach((element) => {
      element.textContent = String(config.secondaryRegistration || 'CREFITO-3');
    });

    // Canais oficiais aparecem apenas quando a configuração contém um destino válido.
    const whatsapp = String(config.whatsapp || '').replace(/\D/g, '');
    const validWhatsapp = /^[1-9]\d{9,14}$/.test(whatsapp)
      && !/(\d)\1{7}/.test(whatsapp) && whatsapp !== '5500000000000';
    const email = String(config.email || '').trim();
    const validEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
      && !/@(?:example\.(?:com|org|net)|exemplo\.com|test\.com|[^@]+\.invalid)$/i.test(email);
    const message = 'Olá. Gostaria de solicitar uma conversa sobre o NOÉRION.';
    all('[data-contact]').forEach((link) => {
      const type = link.dataset.contact;
      const valid = type === 'whatsapp' ? validWhatsapp : type === 'email' && validEmail;
      link.hidden = !valid;
      if (!valid) {
        link.removeAttribute('href');
        link.removeAttribute('target');
        link.removeAttribute('rel');
        return;
      }
      if (type === 'whatsapp') {
        link.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.href = `mailto:${email}`;
        link.removeAttribute('target');
      }
    });
    all('[data-contact-pending]').forEach((element) => { element.hidden = Boolean(validWhatsapp || validEmail); });
    all('[data-contact-group]').forEach((element) => { element.hidden = !element.querySelector('[data-contact]:not([hidden])'); });

    // Leitura permanece visível se JavaScript, IntersectionObserver ou animações não estiverem disponíveis.
    const reveals = all('.reveal');
    const revealAll = () => {
      document.documentElement.classList.remove('js-reveal');
      reveals.forEach((element) => element.classList.add('is-visible'));
    };
    if (motion.matches || !('IntersectionObserver' in window)) {
      revealAll();
    } else {
      try {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.05, rootMargin: '0px 0px -16px 0px' });
        reveals.forEach((element) => observer.observe(element));
        document.documentElement.classList.add('js-reveal');
        const respectMotion = () => {
          if (motion.matches) { observer.disconnect(); revealAll(); }
        };
        if (motion.addEventListener) motion.addEventListener('change', respectMotion);
        else if (motion.addListener) motion.addListener(respectMotion);
      } catch {
        revealAll();
      }
    }

  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
