// ==UserScript==
// @name         크랙 직롤 - 지침 없이 바로 재생성
// @namespace    codex.local.crack-direct-reroll
// @version      1.1.1
// @description  크랙의 기존 재생성 버튼 옆에 '직롤'이라고 표시된 즉시 재생성 버튼을 추가합니다.
// @author       Codex
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const BUTTON_MARKER = 'data-crack-direct-reroll';
  const ACTIVE_ATTRIBUTE = 'data-crack-direct-roll-active';
  const DIALOG_MARKER = 'data-crack-direct-reroll-modal';
  const OVERLAY_MARKER = 'data-crack-direct-reroll-overlay';
  const STYLE_ID = 'crack-direct-reroll-style';
  const REROLL_PATH_START = 'M3.8 12';
  const REROLL_PATH_END = '21.28 8.83';
  const DIALOG_TITLE = '재생성 지침';
  const SUBMIT_LABEL = '답변 재생성';
  const CANCEL_LABEL = '취소';
  const OPEN_TIMEOUT_MS = 4000;

  let running = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      button[${BUTTON_MARKER}] {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        width: auto !important;
        min-width: 42px !important;
        height: 28px !important;
        padding: 0 8px !important;
        overflow: visible !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
        letter-spacing: -0.02em;
      }

      html[${ACTIVE_ATTRIBUTE}="1"] [role="dialog"],
      html[${ACTIVE_ATTRIBUTE}="1"] .fixed.inset-0[class*="z-modal"],
      [${DIALOG_MARKER}="1"],
      [${OVERLAY_MARKER}="1"] {
        visibility: hidden !important;
        opacity: 0 !important;
        display: none !important;
        pointer-events: none !important;
        animation: none !important;
        transition: none !important;
      }

      .crack-direct-reroll-toast {
        position: fixed;
        left: 50%;
        bottom: max(24px, env(safe-area-inset-bottom));
        z-index: 2147483647;
        transform: translateX(-50%);
        max-width: min(420px, calc(100vw - 32px));
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(20, 20, 22, 0.94);
        color: #fff;
        font: 600 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24);
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function isOriginalRerollButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.hasAttribute(BUTTON_MARKER)) return false;
    if (button.getAttribute('aria-label') === '메시지 옵션') return false;

    const pathData = Array.from(button.querySelectorAll('svg path'))
      .map((path) => path.getAttribute('d') || '')
      .join(' ');

    return pathData.includes(REROLL_PATH_START) && pathData.includes(REROLL_PATH_END);
  }

  function findOriginalRerollButtons() {
    const found = new Set();

    // 현재 크랙 UI에서 최신 AI 응답의 글자수 배지가 제공하는 가장 정확한 표식.
    document
      .querySelectorAll('.cmu-message-badge[data-placement="reroll-left"]')
      .forEach((badge) => {
        let sibling = badge.nextElementSibling;
        while (sibling) {
          if (
            sibling instanceof HTMLButtonElement &&
            !sibling.hasAttribute(BUTTON_MARKER) &&
            sibling.getAttribute('aria-label') !== '메시지 옵션'
          ) {
            found.add(sibling);
            break;
          }
          sibling = sibling.nextElementSibling;
        }
      });

    // 배지 클래스나 배치 속성이 바뀌었을 때를 위한 아이콘 기반 보조 탐색.
    document.querySelectorAll('button').forEach((button) => {
      if (isOriginalRerollButton(button)) found.add(button);
    });

    return Array.from(found);
  }

  function directRollLabel() {
    return '<span aria-hidden="true">직롤</span>';
  }

  function createDirectRollButton(originalButton) {
    const button = originalButton.cloneNode(false);

    button.removeAttribute('id');
    button.removeAttribute('aria-haspopup');
    button.removeAttribute('aria-expanded');
    button.removeAttribute('data-state');
    button.setAttribute(BUTTON_MARKER, '1');
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', '직롤');
    button.setAttribute('title', '직롤 — 지침 없이 바로 재생성');
    button.innerHTML = directRollLabel();
    button.disabled = originalButton.disabled;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startDirectRoll(originalButton);
    });

    return button;
  }

  function syncButtons() {
    findOriginalRerollButtons().forEach((originalButton) => {
      let directButton = originalButton.nextElementSibling;

      if (!directButton || !directButton.hasAttribute(BUTTON_MARKER)) {
        directButton = createDirectRollButton(originalButton);
        originalButton.insertAdjacentElement('afterend', directButton);
      }

      directButton.disabled = originalButton.disabled || running;
      directButton.setAttribute('aria-busy', running ? 'true' : 'false');
    });
  }

  function findRegenerationDialog() {
    return Array.from(document.querySelectorAll('[role="dialog"]')).find((dialog) =>
      Array.from(dialog.querySelectorAll('h1, h2, h3')).some(
        (heading) => normalizeText(heading.textContent) === DIALOG_TITLE,
      ),
    );
  }

  function keepRegenerationDialogHidden(dialog) {
    dialog.setAttribute(DIALOG_MARKER, '1');

    // Radix 오버레이는 보통 dialog의 바로 앞 형제지만, UI 변경에 대비해
    // 열려 있는 동일 레이어 오버레이도 함께 표식한다.
    const previous = dialog.previousElementSibling;
    if (
      previous &&
      previous.matches('.fixed.inset-0[class*="z-modal"]')
    ) {
      previous.setAttribute(OVERLAY_MARKER, '1');
    }

    document
      .querySelectorAll('.fixed.inset-0[class*="z-modal"][data-state="open"]')
      .forEach((overlay) => {
        if (overlay !== dialog) overlay.setAttribute(OVERLAY_MARKER, '1');
      });
  }

  function findButtonByText(container, label) {
    return Array.from(container.querySelectorAll('button')).find(
      (button) => normalizeText(button.textContent) === label,
    );
  }

  function setTextareaValue(textarea, value) {
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    );
    const nativeSetter = valueDescriptor && valueDescriptor.set;

    if (nativeSetter) nativeSetter.call(textarea, value);
    else textarea.value = value;

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function showToast(message) {
    const previousToast = document.querySelector('.crack-direct-reroll-toast');
    if (previousToast) previousToast.remove();

    const toast = document.createElement('div');
    toast.className = 'crack-direct-reroll-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);

    window.setTimeout(() => toast.remove(), 2600);
  }

  function startDirectRoll(originalButton) {
    if (running) return;
    if (!originalButton || !originalButton.isConnected || originalButton.disabled) {
      showToast('지금은 재생성할 수 없어요. 잠시 뒤 다시 눌러 주세요.');
      return;
    }

    // 사용자가 직접 열어 둔 재생성 창은 건드리지 않는다.
    if (findRegenerationDialog()) {
      showToast('열려 있는 재생성 지침 창을 먼저 닫아 주세요.');
      return;
    }

    running = true;
    document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, '1');
    syncButtons();

    let finished = false;
    let submissionStarted = false;
    let observer;
    let timeoutId;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (observer) observer.disconnect();
      window.clearTimeout(timeoutId);
      document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE);
      running = false;
      syncButtons();
    };

    const fail = () => {
      if (finished) return;
      const dialog = findRegenerationDialog();
      const cancelButton = dialog && findButtonByText(dialog, CANCEL_LABEL);
      if (cancelButton) cancelButton.click();
      cleanup();
      showToast('직롤을 시작하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
    };

    const submitIfReady = () => {
      if (submissionStarted) return true;

      const dialog = findRegenerationDialog();
      if (!dialog) return false;

      // 전역 숨김 플래그가 해제된 뒤에도 사이트가 모달을 늦게 제거할 수 있다.
      // 모달/오버레이 자체를 표식해 실제 DOM에서 사라질 때까지 계속 숨긴다.
      keepRegenerationDialogHidden(dialog);

      const textarea = dialog.querySelector('textarea');
      const submitButton = findButtonByText(dialog, SUBMIT_LABEL);
      if (!textarea || !submitButton || submitButton.disabled) return false;

      submissionStarted = true;

      // 이전 입력이 남는 경우까지 막아 항상 "지침 없음"을 보장한다.
      const hadInstruction = textarea.value !== '';
      if (hadInstruction) setTextareaValue(textarea, '');

      const submit = () => {
        if (!submitButton.isConnected || submitButton.disabled) {
          fail();
          return;
        }
        submitButton.click();
        window.setTimeout(cleanup, 350);
      };

      // React 입력 상태를 비운 경우 한 프레임 뒤 제출한다. 모달은 계속 숨겨진다.
      if (hadInstruction) window.requestAnimationFrame(submit);
      else submit();

      return true;
    };

    observer = new MutationObserver(() => {
      submitIfReady();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    timeoutId = window.setTimeout(fail, OPEN_TIMEOUT_MS);

    // 사이트의 공식 재생성 버튼을 이용해 요청 형식과 인증 흐름을 그대로 따른다.
    originalButton.click();
    submitIfReady();
  }

  installStyle();
  syncButtons();

  let scanQueued = false;
  const pageObserver = new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    window.requestAnimationFrame(() => {
      scanQueued = false;
      syncButtons();
    });
  });

  pageObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled'],
  });
})();
