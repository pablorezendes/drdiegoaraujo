(() => {
  'use strict';

  const init = () => {
    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

    $$('[data-year]').forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
    const professionalRegister = String(window.NOERION_CONTACT?.crefito || '').trim();
    if (professionalRegister) $$('[data-professional-register]').forEach((element) => {
      element.textContent = `CREFITO ${professionalRegister}`;
    });

    // Navegação compacta.
    const menu = $('#mobile-menu');
    const menuButtons = $$('[data-menu-toggle]');
    const setMenuOpen = (open, restoreFocus = false) => {
      if (!menu) return;
      menu.hidden = !open;
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      menuButtons.forEach((button) => {
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-controls', menu.id);
        button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      });
      if (restoreFocus && menuButtons[0]) menuButtons[0].focus();
    };

    if (menu) {
      setMenuOpen(false);
      menuButtons.forEach((button) => button.addEventListener('click', () => {
        setMenuOpen(button.getAttribute('aria-expanded') !== 'true');
      }));
      $$('a[href]', menu).forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));
      const wideScreen = window.matchMedia('(min-width: 901px)');
      const closeOnWideScreen = () => { if (wideScreen.matches) setMenuOpen(false); };
      if (wideScreen.addEventListener) wideScreen.addEventListener('change', closeOnWideScreen);
      else if (wideScreen.addListener) wideScreen.addListener(closeOnWideScreen);
    }

    const header = $('.site-header');
    if (header) {
      let scrollScheduled = false;
      const updateHeader = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 24);
        scrollScheduled = false;
      };
      updateHeader();
      window.addEventListener('scroll', () => {
        if (!scrollScheduled) {
          scrollScheduled = true;
          window.requestAnimationFrame(updateHeader);
        }
      }, { passive: true });
    }

    // Só os elementos explicitamente marcados recebem a entrada progressiva.
    const reveals = $$('.reveal');
    if (motionPreference.matches || !('IntersectionObserver' in window)) {
      reveals.forEach((element) => element.classList.add('is-visible'));
    } else {
      document.documentElement.classList.add('js-reveal');
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      reveals.forEach((element) => revealObserver.observe(element));
      const revealWithoutMotion = () => {
        if (!motionPreference.matches) return;
        revealObserver.disconnect();
        reveals.forEach((element) => element.classList.add('is-visible'));
      };
      if (motionPreference.addEventListener) motionPreference.addEventListener('change', revealWithoutMotion);
      else if (motionPreference.addListener) motionPreference.addListener(revealWithoutMotion);
    }

    // O sistema pode ser explorado com mouse, toque e teclado.
    const systemTabs = $$('[data-system-tab]');
    const systemPanels = $$('[data-system-panel]');
    const availableTabs = systemTabs.filter((tab) => systemPanels.some((panel) =>
      panel.dataset.systemPanel === tab.dataset.systemTab));

    const activateTab = (tab, focus = false) => {
      if (!tab || !availableTabs.includes(tab)) return;
      const key = tab.dataset.systemTab;
      availableTabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        item.classList.toggle('is-active', selected);
      });
      systemPanels.forEach((panel) => {
        const selected = panel.dataset.systemPanel === key;
        panel.hidden = !selected;
        panel.classList.toggle('is-active', selected);
        panel.setAttribute('role', 'tabpanel');
      });
      if (focus) tab.focus();
    };

    availableTabs.forEach((tab, index) => {
      const panel = systemPanels.find((item) => item.dataset.systemPanel === tab.dataset.systemTab);
      tab.id ||= `system-tab-${index + 1}`;
      panel.id ||= `system-panel-${index + 1}`;
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('aria-labelledby', tab.id);
      tab.addEventListener('click', () => activateTab(tab));
      tab.addEventListener('keydown', (event) => {
        let target;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (index + 1) % availableTabs.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (index - 1 + availableTabs.length) % availableTabs.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = availableTabs.length - 1;
        if (target !== undefined) {
          event.preventDefault();
          activateTab(availableTabs[target], true);
        }
      });
    });
    if (availableTabs.length) {
      activateTab(availableTabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || availableTabs[0]);
    }

    const faqItems = $$('.faq-list details, [data-faq] details, details[data-faq-item]');
    faqItems.forEach((item) => item.addEventListener('toggle', () => {
      if (item.open) faqItems.forEach((other) => { if (other !== item) other.open = false; });
    }));

    // Diálogos nativos mantêm navegação por teclado e restauração de foco.
    const dialogTriggers = new WeakMap();
    const fallbackDialogs = [];
    const syncDialogState = () => document.body.classList.toggle('dialog-open', Boolean($('dialog[open]')));
    const focusFirst = (container) => {
      const target = $('[autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex="0"]', container);
      if (target) target.focus({ preventScroll: true });
    };
    const openDialog = (dialog, trigger) => {
      if (!dialog || dialog.open) return;
      dialogTriggers.set(dialog, trigger || document.activeElement);
      setMenuOpen(false);
      dialog.hidden = false;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        fallbackDialogs.push(dialog);
        focusFirst(dialog);
      }
      syncDialogState();
    };
    const afterDialogClose = (dialog) => {
      dialog.hidden = true;
      const fallbackIndex = fallbackDialogs.indexOf(dialog);
      if (fallbackIndex !== -1) fallbackDialogs.splice(fallbackIndex, 1);
      syncDialogState();
      const trigger = dialogTriggers.get(dialog);
      dialogTriggers.delete(dialog);
      if (trigger && trigger.isConnected && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true });
    };
    const closeDialog = (dialog) => {
      if (!dialog || !dialog.open) return;
      if (typeof dialog.close === 'function') dialog.close();
      else {
        dialog.removeAttribute('open');
        afterDialogClose(dialog);
      }
    };

    $$('dialog').forEach((dialog) => {
      dialog.addEventListener('close', () => afterDialogClose(dialog));
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (outside) closeDialog(dialog);
      });
    });
    $$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
    $$('[data-open-interview]').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault();
      openDialog($('#interview-dialog'), button);
    }));

    $$('[data-open-policy]').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault();
      const policy = button.dataset.openPolicy;
      if (policy !== 'privacy' && policy !== 'terms') return;
      const template = $(`#${policy}-template`);
      const content = $('#policy-content');
      const title = $('#policy-title');
      if (!template || !content) return;
      if (title) title.textContent = template.dataset.title || (policy === 'privacy' ? 'Política de privacidade' : 'Termos de uso');
      content.replaceChildren(template.content.cloneNode(true));
      openDialog($('#policy-dialog'), button);
    }));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu && !menu.hidden) setMenuOpen(false, true);
      const topDialog = fallbackDialogs[fallbackDialogs.length - 1];
      if (!topDialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog(topDialog);
      }
      if (event.key === 'Tab') {
        const focusable = $$('button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]', topDialog)
          .filter((element) => !element.closest('[hidden]'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // A entrevista prepara os dados localmente. Compartilhar exige uma ação explícita.
    const form = $('#interview-form');
    if (!form) return;
    const steps = $$('[data-form-step]', form);
    if (!steps.length) return;
    const result = $('#interview-result');
    const error = $('#form-error');
    const progress = $('#form-progress');
    const stepLabel = $('#form-step-label');
    const sendRequest = $('#send-request');
    const requestStatus = $('#request-status');
    const downloadButton = $('#download-request');
    let currentStep = 0;
    let requestSummary = '';
    form.noValidate = true;

    const clearError = () => { if (error) error.textContent = ''; };
    const showStep = (index, focus = false) => {
      currentStep = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== currentStep;
        step.setAttribute('aria-hidden', String(stepIndex !== currentStep));
      });
      $$('[data-form-back]', form).forEach((button) => { button.disabled = currentStep === 0; });
      $$('[data-form-next]', form).forEach((button) => { button.hidden = currentStep === steps.length - 1; });
      $$('[type="submit"]', form).forEach((button) => { button.hidden = currentStep !== steps.length - 1; });
      if (stepLabel) stepLabel.textContent = `Etapa ${currentStep + 1} de ${steps.length}`;
      if (progress) {
        if (progress.tagName === 'PROGRESS') {
          progress.max = steps.length;
          progress.value = currentStep + 1;
        } else {
          progress.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
          progress.setAttribute('role', 'progressbar');
          progress.setAttribute('aria-valuemin', '0');
          progress.setAttribute('aria-valuemax', String(steps.length));
          progress.setAttribute('aria-valuenow', String(currentStep + 1));
          progress.setAttribute('aria-label', 'Progresso da entrevista');
        }
      }
      clearError();
      if (focus) focusFirst(steps[currentStep]);
    };

    const invalidField = (step) => $$('input, select, textarea', step)
      .find((field) => field.willValidate && !field.validity.valid);

    const fieldError = (field) => {
      if (field.validity.valueMissing) {
        const messages = {
          dimension: 'Selecione a dimensão que mais se aproxima do seu momento.',
          city: 'Informe sua cidade.',
          duration: 'Selecione a duração de interesse para o seu percurso.',
          investment: 'Selecione sua disponibilidade de investimento.',
          name: 'Informe seu nome.',
          email: 'Informe seu e-mail.',
          phone: 'Informe seu telefone com DDD.',
          schedule: 'Selecione sua preferência de horário.',
          privacy: 'Leia e aceite a política de privacidade para preparar a solicitação.'
        };
        return messages[field.name] || 'Preencha o campo indicado para continuar.';
      }
      if (field.name === 'email' && field.validity.typeMismatch) return 'Informe um e-mail válido.';
      if (field.name === 'phone' && field.validity.patternMismatch) return 'Confira seu telefone e inclua o DDD.';
      if (field.validity.tooShort) return `Preencha pelo menos ${field.minLength} caracteres no campo indicado.`;
      return field.validationMessage || 'Confira o campo indicado para continuar.';
    };

    const validateStep = (index) => {
      const invalid = invalidField(steps[index]);
      if (!invalid) return true;
      showStep(index);
      if (error) error.textContent = fieldError(invalid);
      invalid.focus({ preventScroll: true });
      invalid.reportValidity();
      return false;
    };

    $$('[data-form-next]', form).forEach((button) => button.addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(currentStep + 1, true);
    }));
    $$('[data-form-back]', form).forEach((button) => button.addEventListener('click', () => showStep(currentStep - 1, true)));
    form.addEventListener('input', clearError);
    form.addEventListener('change', clearError);

    const valueFor = (name) => {
      const fields = [...form.elements].filter((field) => field.name === name);
      const field = fields.find((item) => item.type === 'radio' ? item.checked : true);
      if (!field) return '';
      if (field.tagName === 'SELECT') return field.selectedOptions[0]?.textContent.trim() || '';
      if (field.type === 'radio') {
        const label = field.labels && field.labels[0];
        if (label) {
          const title = $('[data-option-title], .option-title, strong', label);
          return (title || label).textContent.replace(/\s+/g, ' ').trim();
        }
      }
      return String(field.value || '').trim();
    };

    const prepareRequest = () => {
      const marketing = [...form.elements].find((field) => field.name === 'marketing');
      requestSummary = [
        'SOLICITAÇÃO DE ENTREVISTA — NOERION',
        '',
        `Nome: ${valueFor('name')}`,
        `E-mail: ${valueFor('email')}`,
        `Telefone: ${valueFor('phone')}`,
        `Cidade: ${valueFor('city')}`,
        '',
        `Dimensão de interesse: ${valueFor('dimension')}`,
        `Duração do programa: ${valueFor('duration')}`,
        `Disponibilidade de investimento: ${valueFor('investment')}`,
        `Preferência de horário: ${valueFor('schedule')}`,
        '',
        'Política de privacidade: aceita.',
        `Comunicações opcionais: ${marketing?.checked ? 'autorizadas' : 'não autorizadas'}.`,
        '',
        'Solicitação preparada pela pessoa interessada. O agendamento depende de confirmação da equipe.'
      ].join('\n');

      if (result) {
        let summary = $('#request-summary', result);
        if (!summary) {
          summary = document.createElement('pre');
          summary.id = 'request-summary';
          summary.className = 'request-summary';
          result.insertBefore(summary, sendRequest?.parentElement === result ? sendRequest : result.firstChild);
        }
        summary.textContent = requestSummary;
      }

      const contact = window.NOERION_CONTACT || {};
      const whatsapp = String(contact.whatsapp || '').replace(/\D/g, '');
      const email = String(contact.email || '').trim();
      let destination = '';
      let status = 'Sua solicitação foi preparada. Baixe uma cópia para guardar os seus dados.';
      let label = '';
      if (/^\d{10,15}$/.test(whatsapp)) {
        destination = `https://wa.me/${whatsapp}?text=${encodeURIComponent(requestSummary)}`;
        label = 'Continuar no WhatsApp';
        status = 'Sua solicitação foi preparada. Continue no WhatsApp para compartilhar seus dados com a equipe e solicitar o agendamento.';
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        destination = `mailto:${email}?subject=${encodeURIComponent('Solicitação de entrevista — NOERION')}&body=${encodeURIComponent(requestSummary)}`;
        label = 'Preparar e-mail para a equipe';
        status = 'Sua solicitação foi preparada. Abra seu aplicativo de e-mail, confira os dados e envie para a equipe.';
      }
      if (sendRequest) {
        sendRequest.hidden = !destination;
        if (destination) {
          sendRequest.href = destination;
          sendRequest.textContent = label;
          if (destination.startsWith('https:')) {
            sendRequest.target = '_blank';
            sendRequest.rel = 'noopener noreferrer';
          } else {
            sendRequest.removeAttribute('target');
            sendRequest.removeAttribute('rel');
          }
        } else sendRequest.removeAttribute('href');
      }
      if (requestStatus) requestStatus.textContent = status;
      form.hidden = true;
      if (result) {
        result.hidden = false;
        result.tabIndex = -1;
        result.focus({ preventScroll: true });
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (currentStep < steps.length - 1) {
        if (validateStep(currentStep)) showStep(currentStep + 1, true);
        return;
      }
      for (let index = 0; index < steps.length; index += 1) {
        if (!validateStep(index)) return;
      }
      prepareRequest();
    });

    if (downloadButton) downloadButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (!requestSummary) return;
      const url = URL.createObjectURL(new Blob(['\uFEFF', requestSummary], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'solicitacao-entrevista-noerion.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    const restart = $('#restart-request');
    if (restart) restart.addEventListener('click', (event) => {
      event.preventDefault();
      requestSummary = '';
      const summary = $('#request-summary');
      if (summary) summary.textContent = '';
      if (result) result.hidden = true;
      if (sendRequest) {
        sendRequest.hidden = true;
        sendRequest.removeAttribute('href');
      }
      if (requestStatus) requestStatus.textContent = '';
      form.hidden = false;
      showStep(0, true);
    });

    if (result) result.hidden = true;
    if (sendRequest) sendRequest.hidden = true;
    showStep(0);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
