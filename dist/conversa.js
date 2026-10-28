(() => {
  'use strict';

  const init = () => {
    const form = document.getElementById('conversation-form');
    if (!form) return;
    const first = document.getElementById('passo1');
    const second = document.getElementById('passo2');
    const received = document.getElementById('recebido');
    const progress = document.getElementById('etapa');
    const stepNumber = document.getElementById('etapa-n');
    const error = document.getElementById('form-error');
    const notice = document.getElementById('contact-state');
    const next = document.getElementById('continuar');
    const back = document.getElementById('voltar');
    const send = document.getElementById('enviar');
    const again = document.getElementById('de-novo');
    if (![first, second, received, progress, stepNumber, error, notice, next, back, send, again].every(Boolean)) return;
    let step = 1;
    let pending = false;
    let lastFingerprint = '';
    let requestId = '';
    let activeController;
    const unavailable = 'O envio ainda não está disponível. Os canais profissionais serão informados após confirmação.';
    const fieldNames = ['para', 'interesse', 'origem', 'indicacao', 'cidade', 'valor', 'nome', 'email', 'whatsapp', 'horario', 'site'];
    const config = () => window.NOERION_CONFIG || {};
    const enabled = () => config().contactEnabled === true && config().legalApproved === true;
    const clearError = () => { error.textContent = ''; };
    const reportError = (message, focus = true) => {
      error.textContent = message;
      if (focus) error.focus();
    };
    const syncAvailability = () => {
      notice.hidden = enabled();
      notice.textContent = enabled() ? '' : unavailable;
      send.disabled = pending || !enabled();
    };
    const show = (number, focus = false) => {
      step = number;
      first.hidden = number !== 1;
      second.hidden = number !== 2;
      received.hidden = number !== 3;
      form.hidden = number === 3;
      progress.hidden = number === 3;
      stepNumber.textContent = number === 1 ? '1' : '2';
      clearError();
      if (focus) {
        const target = number === 3 ? received : (number === 1 ? first : second).querySelector('input:not([tabindex="-1"]), select');
        target?.focus();
      }
    };

    const messages = {
      para: 'Selecione para quem é o acompanhamento.',
      interesse: 'Selecione o que mais atrai você neste trabalho.',
      origem: 'Selecione como conheceu o trabalho.',
      cidade: 'Informe a cidade em que seriam os encontros.',
      valor: 'Selecione se faz sentido seguir a conversa.',
      nome: 'Informe seu nome.',
      email: 'Informe um e-mail válido.',
      whatsapp: 'Informe um WhatsApp válido com DDD.',
      privacidade: 'Confirme a leitura da Política de Privacidade.'
    };
    const controls = (container) => [...container.querySelectorAll('input, select')];
    const validEmail = (value) => {
      const parts = value.split('@');
      if (parts.length !== 2) return false;
      const [local, domain] = parts;
      if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
      const labels = domain.split('.');
      return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    };
    const validate = (number) => {
      const container = number === 1 ? first : second;
      const fields = controls(container);
      fields.forEach((field) => {
        field.setCustomValidity('');
        field.removeAttribute('aria-invalid');
        if (field.required && ['text', 'email', 'tel'].includes(field.type) && !field.value.trim()) {
          field.setCustomValidity(messages[field.name] || 'Preencha o campo indicado.');
        }
        const limit = { nome: 160, indicacao: 120, cidade: 120, email: 254 }[field.name];
        if (limit && [...field.value.normalize('NFC').trim()].length > limit) {
          field.setCustomValidity(`Use no máximo ${limit} caracteres neste campo.`);
        }
        if (['nome', 'indicacao', 'cidade', 'email'].includes(field.name) && /[\u0000-\u001f\u007f-\u009f]/u.test(field.value)) {
          field.setCustomValidity('Confira o campo indicado. Use texto em uma única linha.');
        }
        if (field.name === 'email' && field.value.trim() && !validEmail(field.value.trim())) {
          field.setCustomValidity(messages.email);
        }
        if (field.name === 'whatsapp' && field.value.trim() && (!/^[\d\s()+.\-]+$/.test(field.value) || !/^\d{10,15}$/.test(field.value.replace(/\D/g, '')))) {
          field.setCustomValidity(messages.whatsapp);
        }
      });
      const invalid = fields.find((field) => field.willValidate && !field.validity.valid);
      if (!invalid) return true;
      show(number);
      invalid.setAttribute('aria-invalid', 'true');
      reportError(invalid.validationMessage || messages[invalid.name] || 'Confira o campo indicado para continuar.', false);
      invalid.focus();
      invalid.reportValidity();
      return false;
    };
    const advance = () => { if (!pending && validate(1)) show(2, true); };
    next.addEventListener('click', advance);
    back.addEventListener('click', () => { if (!pending) show(1, true); });
    again.addEventListener('click', () => { if (!pending) show(1, true); });
    ['input', 'change'].forEach((type) => form.addEventListener(type, (event) => {
      if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
      event.target.removeAttribute('aria-invalid');
      clearError();
    }));

    const uuid = () => {
      if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID();
      if (typeof window.crypto?.getRandomValues !== 'function') throw new Error('Não foi possível preparar um envio seguro neste navegador.');
      const bytes = window.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
    const payloadFor = () => {
      const data = new FormData(form);
      const payload = {};
      fieldNames.forEach((name) => {
        const value = String(data.get(name) || '');
        payload[name] = name === 'site' ? value : value.normalize('NFC').trim();
      });
      payload.whatsapp = payload.whatsapp.replace(/\D/g, '');
      payload.privacidade = data.has('privacidade');
      payload.comunicacoes = data.has('comunicacoes');
      const fingerprint = JSON.stringify(payload);
      if (fingerprint !== lastFingerprint || !requestId) {
        requestId = uuid();
        lastFingerprint = fingerprint;
      }
      return { ...payload, requestId };
    };
    const endpointFor = () => {
      const endpoint = new URL(String(config().contactEndpoint || '/api/conversa'), window.location.href);
      if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.origin !== window.location.origin || endpoint.username || endpoint.password || endpoint.hash) {
        throw new Error('O canal de envio ainda não está disponível. Tente novamente mais tarde.');
      }
      return endpoint.href;
    };

    const submit = async () => {
      if (pending) return;
      if (step === 1) { advance(); return; }
      if (step === 3) return;
      if (!validate(1) || !validate(2)) return;
      if (!enabled()) { reportError(unavailable); return; }
      let payload;
      let endpoint;
      try {
        payload = payloadFor();
        endpoint = endpointFor();
      } catch (problem) {
        reportError(problem.message || 'Não foi possível preparar a solicitação. Tente novamente.');
        return;
      }
      const disabledBefore = [...form.elements].map((element) => [element, element.disabled]);
      pending = true;
      form.setAttribute('aria-busy', 'true');
      disabledBefore.forEach(([element]) => { element.disabled = true; });
      send.textContent = 'Enviando…';
      clearError();
      activeController = new AbortController();
      let timedOut = false;
      const timeout = window.setTimeout(() => { timedOut = true; activeController?.abort(); }, 15000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: activeController.signal
        });
        let body;
        try { body = await response.json(); } catch { body = null; }
        if (!response.ok || body?.ok !== true) {
          const serverMessage = typeof body?.message === 'string' ? body.message.slice(0, 400).trim() : '';
          throw new Error(serverMessage || 'Não foi possível receber sua solicitação. Seus dados foram mantidos; tente novamente.');
        }
        show(3, true);
      } catch (problem) {
        const message = timedOut
          ? 'O envio demorou mais do que o esperado. Seus dados foram mantidos; tente novamente.'
          : problem.name === 'TypeError' || problem.name === 'AbortError'
            ? 'Não foi possível concluir o envio. Verifique sua conexão e tente novamente. Seus dados foram mantidos.'
            : problem.message || 'Não foi possível concluir o envio. Seus dados foram mantidos; tente novamente.';
        reportError(message);
      } finally {
        window.clearTimeout(timeout);
        activeController = undefined;
        pending = false;
        disabledBefore.forEach(([element, disabled]) => { element.disabled = disabled; });
        form.removeAttribute('aria-busy');
        send.textContent = 'Enviar solicitação';
        syncAvailability();
      }
    };

    form.addEventListener('submit', (event) => { event.preventDefault(); void submit(); });
    form.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing || event.target.closest('button, a, select')) return;
      event.preventDefault();
      void submit();
    });
    window.addEventListener('pagehide', () => activeController?.abort());
    syncAvailability();
    show(1);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
