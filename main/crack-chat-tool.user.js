// ==UserScript==
// @name         🐡 크랙 채팅 도구
// @namespace    codex.local.crack-chat-tools
// @version      1.0.0
// @description  마지막 AI 답변의 직롤과 대화 프로필 생성·정렬·현재 프로필 고정을 함께 제공합니다.
// @author       Codex
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // 원본 기능의 DOM 표식과 저장 키를 유지하고, 각 기능의 변수·초기화를 분리합니다.
  function installDirectReroll() {
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

    function findLatestOriginalRerollButton() {
      // 크랙과 메시지 배지 스크립트가 맨 마지막 AI 응답에만 부여하는 표식.
      // 재생성 전에는 reroll-left, 재생성 후보가 생긴 뒤에는 compare-left다.
      const latestBadge = document.querySelector(
        '.cmu-message-badge[data-placement="reroll-left"], ' +
          '.cmu-message-badge[data-placement="compare-left"]',
      );

      if (latestBadge) {
        let sibling = latestBadge.nextElementSibling;
        while (sibling) {
          if (isOriginalRerollButton(sibling)) return sibling;
          sibling = sibling.nextElementSibling;
        }
      }

      // 배지 표식이 일시적으로 사라진 렌더 구간을 위한 보조 탐색.
      // 대화 DOM이 최신순이므로 첫 번째 공식 재생성 아이콘 하나만 사용한다.
      return Array.from(document.querySelectorAll('button')).find((button) =>
        isOriginalRerollButton(button),
      ) || null;
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
      const originalButton = findLatestOriginalRerollButton();

      // 최신 AI 응답에 붙은 버튼 한 개만 남기고 과거 응답의 직롤은 제거한다.
      document.querySelectorAll(`button[${BUTTON_MARKER}]`).forEach((button) => {
        if (!originalButton || button.previousElementSibling !== originalButton) {
          button.remove();
        }
      });

      if (!originalButton) return;

      let directButton = originalButton.nextElementSibling;
      if (!directButton || !directButton.hasAttribute(BUTTON_MARKER)) {
        directButton = createDirectRollButton(originalButton);
        originalButton.insertAdjacentElement('afterend', directButton);
      }

      const disabled = originalButton.disabled || running;
      if (directButton.disabled !== disabled) directButton.disabled = disabled;
      const busy = running ? 'true' : 'false';
      if (directButton.getAttribute('aria-busy') !== busy) {
        directButton.setAttribute('aria-busy', busy);
      }
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
  }

  function installProfileTools() {
    const STORAGE_KEY = 'crack-profile-sort-mode-v1';
    const TOOLBAR_ID = 'cps-profile-sort-toolbar';
    const STYLE_ID = 'cps-profile-sort-style';
    const SORT_MODES = new Set(['newest', 'oldest', 'name']);
    const dialogStates = new WeakMap();

    let scheduled = false;

    function normalizeText(value) {
      return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function loadSortMode() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return SORT_MODES.has(saved) ? saved : 'newest';
      } catch {
        return 'newest';
      }
    }

    function saveSortMode(mode) {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // localStorage가 막혀 있어도 현재 페이지에서는 정상 동작합니다.
      }
    }

    function installStyles() {
      if (document.getElementById(STYLE_ID)) return;

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${TOOLBAR_ID} {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 20px 12px;
          color: var(--text_primary, currentColor);
        }

        #${TOOLBAR_ID} .cps-create-button {
          flex: 0 0 auto;
          height: 34px;
          border: 1px solid var(--border, rgba(127, 127, 127, .28));
          border-radius: 8px;
          padding: 0 12px;
          background: var(--background, Canvas);
          color: var(--text_primary, CanvasText);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
          cursor: pointer;
          transition: background-color 160ms ease, border-color 160ms ease;
        }

        #${TOOLBAR_ID} .cps-create-button:hover {
          background: var(--accent, rgba(127, 127, 127, .12));
        }

        #${TOOLBAR_ID} .cps-create-button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--focus, rgba(255, 166, 0, .35));
        }

        #${TOOLBAR_ID} .cps-select-wrap {
          position: relative;
          flex: 0 0 auto;
        }

        #${TOOLBAR_ID} select {
          min-width: 112px;
          height: 34px;
          appearance: auto;
          border: 1px solid var(--border, rgba(127, 127, 127, .28));
          border-radius: 8px;
          padding: 0 10px;
          background: var(--background, Canvas);
          color: var(--text_primary, CanvasText);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
          outline: none;
        }

        #${TOOLBAR_ID} select:focus-visible {
          box-shadow: 0 0 0 2px var(--focus, rgba(255, 166, 0, .35));
        }
      `;
      document.head.appendChild(style);
    }

    function isProfileDialog(dialog) {
      if (!(dialog instanceof HTMLElement)) return false;
      if (dialog.dataset.state && dialog.dataset.state !== 'open') return false;

      const heading = dialog.querySelector('h1, h2, h3, [role="heading"]');
      return normalizeText(heading?.textContent) === '대화 프로필';
    }

    function isProfileCard(element) {
      if (!(element instanceof HTMLElement) || element.tagName !== 'DIV') return false;
      return Boolean(
        element.querySelector(':scope > div:first-child button[aria-haspopup="menu"]') &&
        element.querySelector(':scope > p')
      );
    }

    function findProfileList(dialog) {
      const addButton = [...dialog.querySelectorAll('button')].find(
        (button) => normalizeText(button.textContent) === '프로필 추가'
      );

      const scope = addButton?.parentElement ?? dialog;
      const candidates = [...scope.querySelectorAll('div')]
        .map((element) => ({
          element,
          cards: [...element.children].filter(isProfileCard),
        }))
        .filter(({ element, cards }) => cards.length > 0 && cards.length === element.children.length)
        .sort((a, b) => b.cards.length - a.cards.length);

      return candidates[0]?.element ?? null;
    }

    function getProfileName(card) {
      const description = card.querySelector(':scope > p');
      const candidates = [...card.querySelectorAll('span')].filter((span) => {
        const text = normalizeText(span.textContent);
        return text && text !== '현재' && !span.closest('button') && !description?.contains(span);
      });

      return normalizeText(candidates.at(-1)?.textContent);
    }

    function isCurrentProfile(card) {
      return [...card.querySelectorAll('span')].some(
        (span) => normalizeText(span.textContent) === '현재'
      );
    }

    function getDialogState(dialog, list) {
      let state = dialogStates.get(dialog);

      if (!state || state.list !== list) {
        state = {
          list,
          nativeIndex: new WeakMap(),
          nextIndex: 0,
          applying: false,
        };
        dialogStates.set(dialog, state);
      }

      return state;
    }

    function rememberNativeOrder(state, cards) {
      for (const card of cards) {
        if (!state.nativeIndex.has(card)) {
          state.nativeIndex.set(card, state.nextIndex++);
        }
      }
    }

    function sortCards(dialog, mode, { resetScroll = false } = {}) {
      if (!SORT_MODES.has(mode)) return;

      const list = findProfileList(dialog);
      if (!list) return;

      const state = getDialogState(dialog, list);
      if (state.applying) return;

      const nativeCards = [...list.children].filter(isProfileCard);
      if (nativeCards.length < 1) return;

      rememberNativeOrder(state, nativeCards);

      const collator = new Intl.Collator('ko-KR', {
        numeric: true,
        sensitivity: 'base',
      });

      const sortedCards = [...nativeCards].sort((a, b) => {
        const aCurrent = isCurrentProfile(a);
        const bCurrent = isCurrentProfile(b);

        if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;

        const aIndex = state.nativeIndex.get(a) ?? 0;
        const bIndex = state.nativeIndex.get(b) ?? 0;

        if (mode === 'oldest') return aIndex - bIndex;
        if (mode === 'newest') return bIndex - aIndex;

        const byName = collator.compare(getProfileName(a), getProfileName(b));
        return byName || bIndex - aIndex;
      });

      const alreadySorted = sortedCards.every((card, index) => card === nativeCards[index]);
      if (alreadySorted) {
        if (resetScroll) {
          const scroller = list.closest('[class*="overflow-y-scroll"], [class*="overflow-auto"]');
          if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
        }
        return;
      }

      state.applying = true;
      try {
        const fragment = document.createDocumentFragment();
        sortedCards.forEach((card) => fragment.appendChild(card));
        list.appendChild(fragment);

        if (resetScroll) {
          const scroller = list.closest('[class*="overflow-y-scroll"], [class*="overflow-auto"]');
          if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
        }
      } finally {
        state.applying = false;
      }
    }

    function mountToolbar(dialog) {
      if (dialog.querySelector(`#${TOOLBAR_ID}`)) return;

      const list = findProfileList(dialog);
      if (!list) return;

      const scroller = list.closest('[class*="overflow-y-scroll"], [class*="overflow-auto"]');
      if (!(scroller instanceof HTMLElement) || scroller.parentElement !== dialog) return;

      const toolbar = document.createElement('div');
      toolbar.id = TOOLBAR_ID;
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', '대화 프로필 도구');

      const createButton = document.createElement('button');
      createButton.className = 'cps-create-button';
      createButton.type = 'button';
      createButton.textContent = '프로필 생성';
      createButton.addEventListener('click', (event) => {
        event.stopPropagation();

        const nativeCreateButton = [...dialog.querySelectorAll('button')].find(
          (button) => normalizeText(button.textContent) === '프로필 추가'
        );
        nativeCreateButton?.click();
      });

      const selectWrap = document.createElement('div');
      selectWrap.className = 'cps-select-wrap';

      const select = document.createElement('select');
      select.id = 'cps-profile-sort-select';
      select.setAttribute('aria-label', '대화 프로필 정렬 순서');

      const options = [
        ['newest', '최근 순'],
        ['oldest', '오래된 순'],
        ['name', '가나다순'],
      ];

      for (const [value, text] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      }

      select.value = loadSortMode();
      select.addEventListener('click', (event) => event.stopPropagation());
      select.addEventListener('change', () => {
        const mode = select.value;
        saveSortMode(mode);
        sortCards(dialog, mode, { resetScroll: true });
      });

      selectWrap.appendChild(select);
      toolbar.append(createButton, selectWrap);
      dialog.insertBefore(toolbar, scroller);
    }

    function enhanceOpenDialogs() {
      installStyles();

      for (const dialog of document.querySelectorAll('[role="dialog"]')) {
        if (!isProfileDialog(dialog)) continue;
        mountToolbar(dialog);
        sortCards(dialog, loadSortMode());
      }
    }

    function scheduleEnhancement() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        enhanceOpenDialogs();
      });
    }

    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    enhanceOpenDialogs();
  }

  function boot() {
    for (const [name, install] of [
      ['직롤', installDirectReroll],
      ['프로필 도구', installProfileTools],
    ]) {
      try {
        install();
      } catch (error) {
        console.error('[Crack Chat Tools] ' + name + ' 초기화 실패', error);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
