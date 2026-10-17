// ==UserScript==
// @name         크랙 대화 프로필 정렬
// @namespace    codex.crack.profile-sort
// @version      1.2.0
// @description  대화 프로필 생성 바로가기와 정렬 기능을 추가하고 현재 프로필을 맨 위에 고정합니다.
// @author       Codex
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

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
})();
