// ==UserScript==
// @name         🐡ChatGPT 채팅 선택 일괄 삭제
// @namespace    https://chatgpt.com/
// @version      1.8.2
// @description  상단 공유 버튼 옆·사이드바 최근 헤더 액션에서 여는 채팅 정리. 프로젝트 칩·다중선택·현재 채팅 보호·일괄 삭제 지원.
// @author       Local
// @updateURL    https://github.com/eun033/RpCleanerEpub/raw/refs/heads/main/main/chatgpt.chat.tool.user.js
// @downloadURL  https://github.com/eun033/RpCleanerEpub/raw/refs/heads/main/main/chatgpt.chat.tool.user.js
// @match        https://chatgpt.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (window.top !== window.self) return;
  const HOST_ID = 'tm-chatgpt-bulk-delete-v1';
  // An older Tampermonkey copy may already own the same ID. This version takes over.
  // For best results, disable older installed copies in Tampermonkey.
  const previousHost = document.getElementById(HOST_ID);
  if (previousHost) {
    if (previousHost.dataset.build === '1.8.2') return;
    previousHost.remove();
  }

  // NOTE: ChatGPT's private web API can change. No external server is used.
  // The session access token is kept in this closure's memory only.
  const PAGE_SIZE = 100;
  const MAX_PAGES = 100;
  const MAX_PROJECT_PAGES = 100;
  const PROJECT_PAGE_SIZE = 50;
  const DELETE_CONCURRENCY = 3; // Never run more than three delete requests concurrently.
  const DELETE_DELAY_MS = 150; // Each worker waits before starting its next delete.
  const VISIBLE_INCREMENT = 100;
  const BASE = location.origin;
  const state = {
    token: null,
    items: [],
    selected: new Set(),
    query: '',
    displayLimit: VISIBLE_INCREMENT,
    loading: false,
    deleting: false,
    stopRequested: false,
    fetched: false,
    lastFailed: 0,
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const errorMessage = err => (err instanceof Error ? err.message : String(err));

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.dataset.build = '1.8.2';
  // Deliberately append under <html>, not <body>: some pages transform the body,
  // making position:fixed behave as if it were positioned relative to the page.
  // Inline !important offsets also prevent site-wide CSS from overriding position.
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('top', 'max(8px, env(safe-area-inset-top, 0px))', 'important');
  host.style.setProperty('right', 'max(8px, env(safe-area-inset-right, 0px))', 'important');
  host.style.setProperty('bottom', 'auto', 'important');
  host.style.setProperty('left', 'auto', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  document.documentElement.appendChild(host);
  host.dataset.inline = 'true'; // v1.8: no floating launcher, ever.
  const root = host.attachShadow({ mode: 'open' });
  // No conversation titles are ever interpolated into HTML.
  root.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 8px; top: 8px; bottom:auto; left:auto; z-index: 2147483647; font: 13px/1.5 system-ui,-apple-system,"Malgun Gothic",sans-serif; color: #1f2937; }
      *, *::before, *::after { box-sizing: border-box; }
      button, input { font: inherit; }
      button { cursor: pointer; }
      button:disabled { opacity: .46; cursor: not-allowed; }
      :focus-visible { outline: 2px solid #0d9488; outline-offset: 2px; }
      #launcher { display:flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#17212f;box-shadow:0 5px 22px #0002;font-weight:700; }
      #launcher:hover { background:#f1f5f9; }
      #panel { display:none; position:absolute;right:0;top:48px; width:min(530px, calc(100vw - 24px));height:min(730px, calc(100vh - 156px));height:min(730px, calc(100dvh - 156px));min-height:0; background:#fff;color:#17212f;border:1px solid #d1d5db;border-radius:16px;box-shadow:0 16px 50px #0004;overflow:hidden;flex-direction:column; }
      :host([data-open="true"]) #panel { display:flex; }
      #launcher {display:none!important;} /* launch exclusively from native UI */
      :host([data-mini="true"]) #panel,
      :host([data-mini="true"]) #launcher {display:none!important;}
      #miniProgress {display:none;width:min(320px,calc(100vw - 24px));max-height:calc(100dvh - 100px);overflow-y:auto;background:#fff;color:#17212f;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 12px 36px #0004;padding:12px 14px;}
      :host([data-mini="true"]) #miniProgress {display:block;}
      .mini-head {display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .mini-heading {display:inline-flex;align-items:center;gap:2px;min-width:0;}
      #miniTitle {font-size:14px;font-weight:750;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .working-dots {display:inline-flex;align-items:baseline;gap:0;font-weight:800;white-space:nowrap;}
      .working-dots > span {display:inline-block;animation:delete-dot-pulse 1.15s ease-in-out infinite;}
      .working-dots > span:nth-child(2) {animation-delay:.19s;}
      .working-dots > span:nth-child(3) {animation-delay:.38s;}
      @keyframes delete-dot-pulse {0%,65%,100%{opacity:.2;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}
      :host([data-done="true"]) .working-dots {display:none;}
      @media (prefers-reduced-motion: reduce) {.working-dots > span {animation:none!important;opacity:1;transform:none;}}
      #miniPct {font-size:12px;font-weight:750;color:#0f766e;white-space:nowrap;}
      #miniCounts {font-size:12px;color:#475569;margin-top:5px;}
      #miniCompactStatus,#miniCompactDone {display:none;font-size:12px;font-weight:700;white-space:nowrap;align-items:center;gap:1px;}
      #miniCompactDone {font-size:12px;}
      #miniCurrent {font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:7px;min-height:16px;}
      #miniTrack {height:6px;border-radius:999px;background:#e2e8f0;margin-top:9px;overflow:hidden;}
      #miniBar {height:100%;width:0%;background:#0f766e;transition:width .16s ease;}
      .mini-actions {display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:6px;margin-top:10px;}
      .mini-actions button {font-size:12px;}
      .mini-actions .action-icon {display:none;width:17px;height:17px;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none;flex-shrink:0;}
      #miniView,#miniDismiss,#miniReload {display:none;}
      :host([data-done="true"]) #miniStop {display:none;}
      :host([data-done="true"]) #miniView,
      :host([data-done="true"]) #miniDismiss {display:inline-block;}
      /* Desktop completion: title above a compact result/actions row. */
      :host([data-mini="true"][data-done="true"]) #miniProgress {
        display:grid;grid-template-columns:minmax(0,1fr) auto;
        grid-template-areas:"heading heading" "counts actions";
        align-items:center;column-gap:10px;row-gap:8px;
      }
      :host([data-done="true"]) .mini-head {grid-area:heading;}
      :host([data-done="true"]) #miniCounts {
        grid-area:counts;margin:0;min-width:0;font-weight:650;
        color:inherit;white-space:nowrap;
      }
      :host([data-done="true"]) #miniTrack,
      :host([data-done="true"]) #miniCurrent,
      :host([data-done="true"]) #miniPct {display:none;}
      :host([data-done="true"]) .mini-actions {
        grid-area:actions;margin:0;flex-wrap:nowrap;gap:4px;
      }
      :host([data-done="true"]) .mini-actions .btn {
        display:inline-flex;align-items:center;justify-content:center;
        width:29px;min-width:29px;height:29px;min-height:29px;
        padding:0;border-radius:8px;
      }
      :host([data-done="true"]) .mini-actions .action-label {display:none;}
      :host([data-done="true"]) .mini-actions .action-icon {display:block;}
      .head { display:flex; align-items:center;justify-content:space-between;padding:13px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;gap:8px; }
      .head strong {font-size:15px;}
      .head small {display:block;color:#64748b;font-size:11px;font-weight:400;}
      .btn { border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#1f2937;padding:7px 10px;white-space:nowrap; }
      .btn:hover:not(:disabled) {background:#f1f5f9;}
      .btn.primary {background:#0f766e;border-color:#0f766e;color:white;font-weight:650;}
      .btn.primary:hover:not(:disabled) {background:#115e59;}
      .btn.danger {background:#b91c1c;border-color:#b91c1c;color:white;font-weight:700;}
      .btn.danger:hover:not(:disabled) {background:#991b1b;}
      .btn.flat {border:0;background:transparent;padding:5px 8px;}
      .btn.flat:hover {background:#e2e8f0;}
      .tools {padding:11px 12px 9px;border-bottom:1px solid #e5e7eb;display:grid;gap:8px;}
      .tools > input {width:100%;min-width:0;background:#fff;color:inherit;border:1px solid #cbd5e1;border-radius:8px;padding:9px 11px;}
      .actions {display:flex;align-items:center;flex-wrap:wrap;gap:6px;}
      #count {margin-left:auto;color:#0f766e;font-weight:750;white-space:nowrap;}
      #notice {font-size:11px;color:#64748b;line-height:1.4;}
      #status {padding:8px 12px; background:#f1f5f9;border-bottom:1px solid #e2e8f0;color:#475569;word-break:break-word;}
      #status[data-kind="error"] {color:#b91c1c;background:#fef2f2;}
      #status[data-kind="success"] {color:#047857;background:#ecfdf5;}
      #list { flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:4px 0; }
      .item {display:flex;align-items:flex-start;gap:9px;padding:9px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;}
      .item:hover {background:#f8fafc;}
      .item.selected {background:#e7f7f2;}
      .item.protected {cursor:default;opacity:.66;background:#f1f5f9;}
      .item.protected:hover {background:#f1f5f9;}
      .protected-mark {font-size:10px;color:#b45309;font-weight:650;}
      .item input { margin-top:3px; accent-color:#0f766e; width:15px;height:15px;flex-shrink:0;}
      .details {min-width:0;flex:1;}
      .title {word-break:break-word;color:#17212f;line-height:1.45;}
      .meta {display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:3px;}
      .date {font-size:10px;color:#94a3b8;}
      .project-chip {display:inline-flex;align-items:center;gap:4px;max-width:min(72vw,260px);min-width:0;padding:2px 9px 2px 7px;border:1px solid #99dacc;border-radius:999px;background:#e8f8f3;color:#0f766e;font-size:11px;line-height:1.4;font-weight:750;vertical-align:middle;}
      .project-chip-icon {font-size:12px;line-height:1;flex-shrink:0;}
      .project-chip-name {display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .muted {padding:16px;color:#64748b;text-align:center;}
      .more {display:block;width:calc(100% - 26px);margin:10px 13px;}
      .foot {display:flex;align-items:center;gap:7px;justify-content:flex-end;padding:11px 12px;border-top:1px solid #e2e8f0;background:#f8fafc;}
      .foot .hint {margin-right:auto;font-size:11px;color:#64748b;}
      #confirm {display:none;position:absolute;inset:0;background:#0009;align-items:center;justify-content:center;padding:18px;z-index:3;}
      #confirm[data-show="true"] {display:flex;}
      .dialog {background:#fff;width:100%;max-height:95%;overflow:auto;border-radius:12px;padding:17px;box-shadow:0 12px 28px #0003;}
      .dialog strong {font-size:16px;color:#991b1b;}
      .dialog p {margin:10px 0;color:#374151;}
      #preview {margin:10px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;max-height:170px;overflow:auto;padding:10px;font-size:12px;white-space:pre-wrap;word-break:break-word;}
      .dialog-actions {display:flex;gap:8px;justify-content:flex-end;margin-top:12px;}
      @media (prefers-color-scheme: dark) {
        :host {color:#f1f5f9;}
        #launcher,#panel,.dialog,#miniProgress {background:#202124;color:#f1f5f9;border-color:#475569;}
        .head,.foot {background:#26282b;border-color:#475569;}
        .head small,#notice,.hint,.date {color:#a8b3c2!important;}
        .project-chip {color:#a7f3d0;background:#134e4a;border-color:#0f766e;}
        .btn {background:#32363b;border-color:#64748b;color:#f1f5f9;}
        .btn:hover:not(:disabled),.btn.flat:hover,#launcher:hover {background:#3d434a;}
        .tools,.item,#status {border-color:#475569;}
        .tools>input {background:#292c32;border-color:#64748b;color:#f1f5f9;}
        #miniCounts,#miniCurrent {color:#cbd5e1;}
        #miniPct {color:#5eead4;}
        #miniTrack {background:#475569;}
        #status {background:#2b3038;color:#cbd5e1;}
        #status[data-kind="error"] {background:#4b2222;color:#fecaca;}
        #status[data-kind="success"] {background:#123c32;color:#a7f3d0;}
        .item:hover {background:#32363b;}
        .item.selected {background:#16483f;}
        .item.protected,.item.protected:hover {background:#30353b;}
        .protected-mark {color:#fbbf24;}
        .title,.dialog p {color:#f1f5f9;}
        #preview {background:#292c32;border-color:#475569;}
      }
      /* Launcher, full panel and compact delete progress are anchored near the viewport TOP-right. */
      @media (max-width: 540px) {
        :host {right:max(8px, env(safe-area-inset-right, 0px));top:max(8px, env(safe-area-inset-top, 0px));}
        #launcher {min-height:42px;padding:8px 12px;}
        #panel {top:46px; width:calc(100vw - 16px);height:min(730px,calc(100vh - 130px));height:min(730px,calc(100dvh - 130px - env(safe-area-inset-top, 0px)));}
        .head {padding:9px 10px;}
        .tools {padding:8px 10px;gap:6px;}
        .actions {gap:5px;}
        .btn {min-height:36px;padding:7px 8px;}
        .item {min-height:46px;padding:9px 10px;}
        .item input {width:18px;height:18px;}
        .foot {padding:8px 10px;}
        #confirm {padding:10px;}
        .dialog {padding:13px;max-height:100%;}
      }
      /* Small/short view: a single line while deleting. Full completion actions remain available. */
      @media (max-width: 540px), (max-height: 620px) {
        #miniProgress {width:min(252px,calc(100vw - 16px));padding:8px 10px;border-radius:11px;}
        #miniTitle {font-size:12px;}
        #miniPct {font-size:11px;}
        #miniCounts {font-size:11px;margin-top:3px;white-space:nowrap;}
        #miniCurrent {display:none;}
        #miniTrack {height:5px;margin-top:6px;}
        .mini-actions {margin-top:6px;gap:4px;}
        .mini-actions .btn {font-size:11px;min-height:30px;padding:4px 7px;}
        :host([data-mini="true"]:not([data-done="true"])) #miniProgress {
          display:flex;align-items:center;justify-content:space-between;gap:9px;
          width:max-content;max-width:calc(100vw - 16px);padding:5px 9px;overflow:hidden;
        }
        :host([data-mini="true"]:not([data-done="true"])) #miniCompactStatus {display:inline-flex;}
        :host([data-mini="true"]:not([data-done="true"])) .mini-head,
        :host([data-mini="true"]:not([data-done="true"])) #miniCounts,
        :host([data-mini="true"]:not([data-done="true"])) #miniTrack,
        :host([data-mini="true"]:not([data-done="true"])) #miniCurrent {display:none;}
        :host([data-mini="true"]:not([data-done="true"])) .mini-actions {
          margin:0;flex-wrap:nowrap;flex-shrink:0;
        }
        /* Completion also stays on one line; failure count is conditional. */
        :host([data-mini="true"][data-done="true"]) #miniProgress {
          display:flex;align-items:center;justify-content:space-between;gap:7px;
          width:max-content;max-width:calc(100vw - 16px);padding:5px 8px;overflow:hidden;
        }
        :host([data-mini="true"][data-done="true"]) #miniCompactDone {display:inline-flex;}
        :host([data-mini="true"][data-done="true"]) .mini-head,
        :host([data-mini="true"][data-done="true"]) #miniCounts,
        :host([data-mini="true"][data-done="true"]) #miniTrack,
        :host([data-mini="true"][data-done="true"]) #miniCurrent {display:none;}
        :host([data-mini="true"][data-done="true"]) .mini-actions {
          margin:0;flex-wrap:nowrap;flex-shrink:0;gap:4px;
        }
        :host([data-mini="true"][data-done="true"]) .mini-actions .btn {
          width:31px;min-width:31px;height:31px;min-height:31px;padding:0;
          display:inline-flex;align-items:center;justify-content:center;border-radius:8px;
        }
        :host([data-mini="true"][data-done="true"]) .mini-actions .action-label {display:none;}
        :host([data-mini="true"][data-done="true"]) .mini-actions .action-icon {display:block;}
      }
      @media (max-width: 390px) {
        #launcher {width:42px;padding:0;font-size:18px;}
        .launcher-label {display:none;}
        .head small {display:none;}
        #notice {font-size:10px;}
        .foot .hint {display:none;}
        .actions .btn {font-size:11px;padding:6px;}
      }
      /* Landscape phones and unusually short desktop windows remain usable. */
      @media (max-height: 540px) {
        :host {top:max(8px, env(safe-area-inset-top, 0px));}
        #panel {height:calc(100dvh - 66px);}
        .head small,#notice {display:none;}
        .tools {padding:5px 8px;gap:5px;}
        .tools > input {padding:6px 8px;}
        #status {padding:5px 8px;}
        .head,.foot {padding:6px 8px;}
        .item {padding:5px 8px;min-height:36px;}
        #miniProgress {max-height:calc(100dvh - 65px);}
      }
      @media (max-height: 360px) {
        :host {top:max(8px, env(safe-area-inset-top, 0px));}
        #panel {top:44px;height:calc(100dvh - 60px);}
        #miniProgress {max-height:calc(100dvh - 20px);}
      }
    </style>
    <section id="panel" role="dialog" aria-label="ChatGPT 채팅 일괄 관리" aria-modal="false">
      <div class="head">
        <div><strong>채팅 선택 삭제</strong><small>일반·프로젝트 대화 통합 · 외부 전송 없음</small></div>
        <button id="refresh" class="btn" title="서버 목록 다시 불러오기">새로고침</button>
        <button id="close" class="btn flat" aria-label="관리창 닫기">✕</button>
      </div>
      <div class="tools">
        <input id="search" type="search" placeholder="채팅 제목 또는 프로젝트명 검색" aria-label="채팅 제목 또는 프로젝트명 검색" />
        <div class="actions">
          <button id="selectFiltered" class="btn">검색 결과 선택</button>
          <button id="unselectFiltered" class="btn">검색 결과 해제</button>
          <button id="clear" class="btn">전체 선택 해제</button>
          <span id="count">0개 선택</span>
        </div>
        <div id="notice">최근 활동순 · 현재 열려 있는 채팅은 선택/삭제 불가 · 삭제 복구 불가</div>
      </div>
      <div id="status" role="status" aria-live="polite">'채팅 정리'를 열면 목록을 불러옵니다.</div>
      <div id="list" aria-label="대화 목록"></div>
      <div class="foot">
        <span class="hint" id="hint">선택한 항목만 처리</span>
        <button id="stop" class="btn" hidden>중지</button>
        <button id="reload" class="btn" hidden>페이지 새로고침</button>
        <button id="delete" class="btn danger" disabled>선택 삭제 (0)</button>
      </div>
      <div id="confirm" aria-label="삭제 확인">
        <div class="dialog">
          <strong id="confirmTitle">정말 삭제하시겠습니까?</strong>
          <p>선택한 채팅은 복구할 수 없습니다. 아래 목록을 확인하세요.</p>
          <div id="preview"></div>
          <div class="dialog-actions">
            <button id="cancelConfirm" class="btn">취소</button>
            <button id="doDelete" class="btn danger">삭제 실행</button>
          </div>
        </div>
      </div>
    </section>
    <section id="miniProgress" role="status" aria-live="polite" aria-label="삭제 진행 상황">
      <div id="miniCompactStatus"><span id="miniCompactCount">0/0 삭제중</span><span class="working-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></div>
      <div id="miniCompactDone">삭제완료</div>
      <div class="mini-head"><div class="mini-heading"><strong id="miniTitle">삭제 처리 중</strong><span class="working-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></div><span id="miniPct" aria-hidden="true">0%</span></div>
      <div id="miniCounts">0 / 0 · 성공 0 · 실패 0</div>
      <div id="miniTrack" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="채팅 삭제 진행률"><div id="miniBar"></div></div>
      <div id="miniCurrent"></div>
      <div class="mini-actions">
        <button id="miniStop" class="btn">중지</button>
        <button id="miniReload" class="btn" aria-label="페이지 새로고침" title="페이지 새로고침"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 4v7h-7"/></svg><span class="action-label">페이지 새로고침</span></button>
        <button id="miniDismiss" class="btn" aria-label="알림 닫기" title="알림 닫기"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg><span class="action-label">닫기</span></button>
        <button id="miniView" class="btn primary" aria-label="채팅 목록 보기" title="채팅 목록 보기"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg><span class="action-label">목록 보기</span></button>
      </div>
    </section>
    <button id="launcher" title="채팅 정리" aria-label="채팅 일괄 관리 창 열기"><span aria-hidden="true">🧹</span><span class="launcher-label">채팅 정리</span></button>
  `;
  const $ = id => root.getElementById(id);
  const setStatus = (message, kind = '') => {
    $('status').textContent = message;
    $('status').dataset.kind = kind;
  };

  // Works for both regular /c/{id} and project /g/{projectId}/c/{id} routes.
  // Read location on each action: ChatGPT navigates without full-page reloads.
  function getActiveConversationId() {
    const match = (location.pathname || '').match(/(?:^|\/)c\/([a-zA-Z0-9_-]{8,128})(?:\/|$)/);
    return match ? match[1] : '';
  }
  function removeActiveFromSelection() {
    const id = getActiveConversationId();
    if (id) state.selected.delete(id);
    return id;
  }

  function filteredItems() {
    const q = state.query.trim().toLocaleLowerCase();
    return q ? state.items.filter(item => item.title.toLocaleLowerCase().includes(q) || item.projectName.toLocaleLowerCase().includes(q)) : state.items;
  }
  function dateText(date) {
    if (!date) return '';
    const normalized = typeof date === 'string' && /^\d{10,13}$/.test(date) ? Number(date) : date;
    const value = typeof normalized === 'number' ? new Date(normalized > 1e12 ? normalized : normalized * 1000) : new Date(normalized);
    return Number.isNaN(value.getTime()) ? '' : value.toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });
  }
  function refreshControls() {
    removeActiveFromSelection();
    $('count').textContent = `${state.selected.size.toLocaleString()}개 선택`;
    $('delete').textContent = `선택 삭제 (${state.selected.size.toLocaleString()})`;
    $('delete').disabled = state.loading || state.deleting || !state.selected.size;
    $('refresh').disabled = state.loading || state.deleting;
    $('selectFiltered').disabled = state.loading || state.deleting || !filteredItems().length;
    $('unselectFiltered').disabled = state.loading || state.deleting || !state.selected.size;
    $('clear').disabled = state.loading || state.deleting || !state.selected.size;
    $('search').disabled = state.loading || state.deleting;
    $('close').disabled = state.deleting;
    $('stop').hidden = !state.deleting;
    $('stop').disabled = state.stopRequested;
    $('stop').textContent = state.stopRequested ? '중지 요청됨' : '중지';
  }
  function renderList() {
    const list = $('list');
    list.replaceChildren();
    const filtered = filteredItems();
    const subset = filtered.slice(0, state.displayLimit);
    const activeId = removeActiveFromSelection();
    if (!subset.length) {
      list.append(el('div', 'muted', state.loading ? '목록 불러오는 중…' : state.fetched ? '표시할 채팅이 없습니다.' : '채팅 목록을 불러와 주세요.'));
    }
    const fragment = document.createDocumentFragment();
    for (const item of subset) {
      const protectedNow = item.id === activeId;
      const label = el('label', `item${state.selected.has(item.id) ? ' selected' : ''}${protectedNow ? ' protected' : ''}`);
      const checkbox = el('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !protectedNow && state.selected.has(item.id);
      checkbox.disabled = state.loading || state.deleting || protectedNow;
      checkbox.title = protectedNow ? '현재 열려 있는 채팅방은 삭제할 수 없습니다.' : '';
      checkbox.setAttribute('aria-label', protectedNow ? `${item.title} (현재 채팅, 삭제 불가)` : `${item.title} 선택`);
      checkbox.addEventListener('change', () => {
        if (state.loading || state.deleting || item.id === getActiveConversationId()) {
          checkbox.checked = false;
          state.selected.delete(item.id);
        } else if (checkbox.checked) state.selected.add(item.id);
        else state.selected.delete(item.id);
        label.classList.toggle('selected', checkbox.checked);
        refreshControls();
      });
      const details = el('div', 'details');
      details.append(el('div', 'title', item.title));
      const meta = el('div', 'meta');
      if (protectedNow) meta.append(el('span', 'protected-mark', '현재 채팅 · 삭제 불가'));
      // Stand-out project chip; regular chats keep the field empty.
      if (item.projectId) {
        const chip = el('span', 'project-chip');
        chip.title = `프로젝트: ${item.projectName || '이름 확인 불가'}`;
        const folder = el('span', 'project-chip-icon', '📁');
        folder.setAttribute('aria-hidden', 'true');
        chip.append(folder, el('span', 'project-chip-name', item.projectName || '이름 확인 불가'));
        meta.append(chip);
      }
      const time = dateText(item.updated);
      if (time) meta.append(el('span', 'date', time));
      if (meta.childNodes.length) details.append(meta);
      label.append(checkbox, details);
      fragment.appendChild(label);
    }
    list.appendChild(fragment);
    if (filtered.length > subset.length) {
      const more = el('button', 'btn more', `더 보기 (${subset.length.toLocaleString()} / ${filtered.length.toLocaleString()})`);
      more.disabled = state.deleting;
      more.addEventListener('click', () => {state.displayLimit += VISIBLE_INCREMENT; renderList();});
      list.append(more);
    }
    $('hint').textContent = `${filtered.length.toLocaleString()}개 검색됨 / 전체 ${state.items.length.toLocaleString()}개`;
    refreshControls();
  }

  async function getToken(force = false) {
    if (state.token && !force) return state.token;
    const response = await fetch(`${BASE}/api/auth/session`, { credentials:'include', cache:'no-store', headers: {'Accept':'application/json'} });
    if (!response.ok) throw new Error(`로그인 세션 확인 실패 (HTTP ${response.status})`);
    const session = await response.json();
    if (!session || !session.accessToken) throw new Error('로그인 토큰을 읽을 수 없습니다. ChatGPT에 로그인한 뒤 새로고침하세요.');
    state.token = session.accessToken;
    return state.token;
  }

  async function apiRequest(path, method = 'GET', body, tries = 3) {
    for (let attempt = 0; attempt < tries; attempt++) {
      const token = await getToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let response;
      try {
        response = await fetch(`${BASE}${path}`, {
          method, credentials:'include', signal:controller.signal,
          headers: { 'Authorization':`Bearer ${token}`, 'Accept':'application/json', ...(body ? {'Content-Type':'application/json'} : {}) },
          ...(body ? {body:JSON.stringify(body)} : {}),
        });
      } catch (err) {
        throw new Error(err?.name === 'AbortError' ? '요청 시간 초과 (재시도 전 상태 확인 필요)' : `네트워크 요청 실패: ${errorMessage(err)}`);
      } finally {
        clearTimeout(timeoutId);
      }
      if (response.status === 401 && attempt < tries - 1) {
        await getToken(true);
        continue;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < tries - 1) {
        await sleep(800 * (2 ** attempt));
        continue;
      }
      if (!response.ok) {
        const err = new Error(`HTTP ${response.status} (${method} ${path.split('?')[0]})`);
        err.status = response.status;
        throw err;
      }
      if (response.status === 204) return null;
      const contentType = response.headers.get('content-type') || '';
      return contentType.includes('application/json') ? response.json() : null;
    }
    throw new Error('재시도 횟수를 초과했습니다.');
  }

  // Project data uses a separate ChatGPT web endpoint. It is not always present
  // in the standard /conversations feed, so both sources must be merged.
  const validConversationId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(id);
  const validProjectId = id => typeof id === 'string' && /^g-p-[a-zA-Z0-9_-]{8,128}$/.test(id);
  const readEntries = data => Array.isArray(data?.items) ? data.items : Array.isArray(data?.conversations) ? data.conversations : null;
  const projectOfEntry = entry => {
    for (const candidate of [entry?.gizmo_id, entry?.project_id, entry?.conversation_template_id]) {
      if (validProjectId(candidate)) return candidate;
    }
    return '';
  };
  const toUpdatedMs = value => {
    if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
    if (typeof value === 'string') return /^\d{10,13}$/.test(value) ? toUpdatedMs(Number(value)) : (Date.parse(value) || 0);
    return 0;
  };

  async function loadConversations() {
    if (state.loading || state.deleting) return;
    state.loading = true;
    refreshControls();
    setStatus('일반 대화와 프로젝트 대화 목록을 불러오는 중…');
    const itemsById = new Map();
    const projectNames = new Map();
    const warnings = [];
    let projectCount = 0;

    function addConversation(entry, projectId = '', projectName = '') {
      const id = entry?.id;
      if (!validConversationId(id) || entry.is_visible === false) return;
      const existing = itemsById.get(id);
      const assignedProjectId = projectId || projectOfEntry(entry) || existing?.projectId || '';
      const dates = [entry.update_time, entry.updated_at, entry.last_message_at, entry.create_time, existing?.updated];
      const latest = dates.reduce((best, value) => toUpdatedMs(value) > toUpdatedMs(best) ? value : best, null);
      itemsById.set(id, {
        id,
        title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : existing?.title || '(제목 없음)',
        updated: latest,
        projectId: assignedProjectId,
        projectName: projectName || existing?.projectName || '',
      });
    }

    try {
      // Phase 1: normal conversations, including some that may carry project IDs.
      let offset = 0;
      let rootDone = false;
      for (let page = 0; page < MAX_PAGES; page++) {
        const data = await apiRequest(`/backend-api/conversations?offset=${offset}&limit=${PAGE_SIZE}&order=updated`);
        const chunk = readEntries(data);
        if (!chunk) throw new Error('일반 대화 목록 API 응답 형식이 변경되었습니다.');
        for (const entry of chunk) addConversation(entry);
        setStatus(`일반 대화 조회 중… ${itemsById.size.toLocaleString()}개 확인`);
        if (!chunk.length || data.has_more === false || (chunk.length < PAGE_SIZE && data.has_more !== true)) {
          rootDone = true;
          break;
        }
        offset += chunk.length;
      }
      if (!rootDone) throw new Error(`일반 대화 ${MAX_PAGES * PAGE_SIZE}개 조회 상한에 도달했습니다. 안전을 위해 목록 적용을 중단합니다.`);

      // Phase 2: discover Projects. The sidebar endpoint is cursor-paginated.
      let sidebarCursor = '';
      const seenSidebarCursors = new Set();
      let sidebarDone = false;
      try {
        for (let page = 0; page < MAX_PROJECT_PAGES; page++) {
          const suffix = sidebarCursor ? `&cursor=${encodeURIComponent(sidebarCursor)}` : '';
          const data = await apiRequest(`/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0${suffix}`);
          const projects = [
            ...(Array.isArray(data?.items) ? data.items : []),
            ...(Array.isArray(data?.gizmos) ? data.gizmos : []),
          ];
          if (!Array.isArray(data?.items) && !Array.isArray(data?.gizmos)) {
            throw new Error('프로젝트 목록 API 응답 형식이 변경되었습니다.');
          }
          for (const wrapper of projects) {
            // Both {gizmo:{gizmo:{...}}} and {gizmo:{...}} are used in the wild.
            const project = wrapper?.gizmo?.gizmo || wrapper?.gizmo || wrapper;
            const id = project?.id;
            if (!validProjectId(id)) continue; // Ignore custom GPTs (non-Projects).
            const name = typeof project?.display?.name === 'string' ? project.display.name.trim() : '';
            if (!projectNames.has(id) || (name && !projectNames.get(id))) projectNames.set(id, name);
          }
          const next = data?.cursor;
          if (next === null || next === undefined || next === '') { sidebarDone = true; break; }
          const key = String(next);
          if (seenSidebarCursors.has(key)) throw new Error('프로젝트 목록의 페이지 커서가 반복됩니다.');
          seenSidebarCursors.add(key);
          sidebarCursor = key;
        }
        if (!sidebarDone) throw new Error('프로젝트 목록 페이지 조회 상한에 도달했습니다.');
      } catch (err) {
        warnings.push(`프로젝트 목록 조회 실패: ${errorMessage(err)}`);
      }

      // Merge any project names from the root feed before project enumeration.
      for (const item of itemsById.values()) {
        if (item.projectId && projectNames.has(item.projectId)) item.projectName = projectNames.get(item.projectId) || '';
      }

      // Phase 3: fetch all project conversations (not just the ones in the root list).
      const projectEntries = [...projectNames.entries()];
      for (let projectIndex = 0; projectIndex < projectEntries.length; projectIndex++) {
        const [projectId, name] = projectEntries[projectIndex];
        setStatus(`프로젝트 조회 중… ${projectIndex + 1}/${projectEntries.length} · ${name || '(이름 없음)'}`);
        let cursor = '0';
        const usedCursors = new Set();
        let finished = false;
        try {
          for (let page = 0; page < MAX_PROJECT_PAGES; page++) {
            if (usedCursors.has(cursor)) throw new Error('프로젝트 채팅 목록의 커서가 반복됩니다.');
            usedCursors.add(cursor);
            const url = `/backend-api/gizmos/${encodeURIComponent(projectId)}/conversations?cursor=${encodeURIComponent(cursor)}&limit=${PROJECT_PAGE_SIZE}`;
            const data = await apiRequest(url);
            const chunk = readEntries(data);
            if (!chunk) throw new Error('프로젝트 채팅 API 응답 형식이 변경되었습니다.');
            for (const entry of chunk) addConversation(entry, projectId, name);
            const next = data?.cursor;
            if (next === null || next === undefined || next === '') { finished = true; break; }
            cursor = String(next);
          }
          if (!finished) throw new Error('프로젝트 채팅 페이지 조회 상한에 도달했습니다.');
        } catch (err) {
          warnings.push(`프로젝트 '${name || projectId}' 채팅 조회 실패: ${errorMessage(err)}`);
        }
      }

      // Resolve project names for all entries, including those from the root API.
      const all = [...itemsById.values()];
      for (const item of all) {
        if (item.projectId) item.projectName = projectNames.get(item.projectId) || item.projectName || '';
        if (item.projectId) projectCount++;
      }
      // Always show most recently active conversations first, including project chats.
      all.sort((a, b) => toUpdatedMs(b.updated) - toUpdatedMs(a.updated) || a.id.localeCompare(b.id));
      state.items = all;
      state.selected = new Set([...state.selected].filter(id => itemsById.has(id) && id !== getActiveConversationId()));
      state.fetched = true;
      state.displayLimit = VISIBLE_INCREMENT;
      renderList();
      if (warnings.length) {
        setStatus(`일부 조회 실패 · ${all.length.toLocaleString()}개 표시 (프로젝트 ${projectCount.toLocaleString()}개). 누락된 프로젝트 채팅이 있을 수 있습니다. ${warnings[0]}`, 'error');
      } else {
        setStatus(`대화 ${all.length.toLocaleString()}개 불러옴 · 프로젝트 ${projectCount.toLocaleString()}개 · 일반 ${(all.length - projectCount).toLocaleString()}개`, 'success');
      }
    } catch (err) {
      setStatus(`목록 불러오기 실패: ${errorMessage(err)}`, 'error');
    } finally {
      state.loading = false;
      // Important: the list was rendered while loading=true. Re-render all rows
      // once loading completes, otherwise first-load checkboxes stay disabled.
      renderList();
    }
  }

  function openConfirm() {
    if (state.deleting || state.loading || state.selected.size === 0) return;
    removeActiveFromSelection();
    const selected = state.items.filter(item => state.selected.has(item.id) && item.id !== getActiveConversationId());
    if (!selected.length) return;
    $('confirmTitle').textContent = `${selected.length.toLocaleString()}개 채팅을 삭제하시겠습니까?`;
    const titles = selected.slice(0, 12).map((item, i) => `${i + 1}. ${item.projectName ? `[${item.projectName}] ` : ''}${item.title}`);
    if (selected.length > 12) titles.push(`… 외 ${(selected.length - 12).toLocaleString()}개`);
    $('preview').textContent = titles.join('\n');
    $('confirm').dataset.show = 'true';
    $('doDelete').focus();
  }
  function closeConfirm() { $('confirm').dataset.show = 'false'; }

  async function deleteOne(id) {
    // Current and legacy ChatGPT UI implementations may use either endpoint.
    // The PATCH matches the former native Delete action: hide from account history.
    try {
      const result = await apiRequest(`/backend-api/conversation/${encodeURIComponent(id)}`, 'PATCH', { is_visible:false });
      if (result?.success === false) throw new Error('서버가 삭제 실패를 반환했습니다.');
    } catch (err) {
      if (err?.status !== 404 && err?.status !== 405) throw err;
      // Compatibility fallback for ChatGPT versions that migrated to DELETE /id/{id}.
      const result = await apiRequest(`/backend-api/conversation/id/${encodeURIComponent(id)}`, 'DELETE');
      if (result?.success === false) throw new Error('서버가 삭제 실패를 반환했습니다.');
    }
  }

  function renderMini(done, total, ok, failed, detail = '') {
    $('miniCompactCount').textContent = `${done.toLocaleString()}/${total.toLocaleString()} 삭제중`;
    $('miniCounts').textContent = `${done.toLocaleString()} / ${total.toLocaleString()} · 성공 ${ok} · 실패 ${failed}`;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('miniBar').style.width = `${pct}%`;
    $('miniPct').textContent = `${pct}%`;
    $('miniTrack').setAttribute('aria-valuenow', String(pct));
    if (detail) $('miniCurrent').textContent = detail;
  }

  async function deleteSelected() {
    if (state.deleting || state.loading) return;
    // Re-check at execution time, not only when the confirmation dialog opened.
    const initialActiveId = removeActiveFromSelection();
    const target = state.items.filter(item => state.selected.has(item.id) && item.id !== initialActiveId);
    if (!target.length) { closeConfirm(); renderList(); return; }
    closeConfirm();
    state.deleting = true;
    if (typeof updateEntryButtons === 'function') updateEntryButtons();
    state.stopRequested = false;
    host.dataset.open = 'false';
    host.dataset.mini = 'true';
    host.dataset.done = 'false';
    $('miniTitle').textContent = '삭제 처리 중';
    $('miniCompactDone').textContent = '삭제완료';
    $('miniCurrent').textContent = '서버에 삭제 요청 중…';
    $('miniStop').disabled = false;
    $('miniStop').textContent = '중지';
    $('miniReload').style.display = 'none';
    $('miniView').style.display = 'none';
    $('miniDismiss').style.display = 'none';
    $('reload').hidden = true;
    let nextIndex = 0;
    let done = 0, ok = 0, failed = 0, skipped = 0;
    const succeededIds = new Set();
    const failures = [];
    refreshControls();
    renderMini(0, target.length, 0, 0);

    async function worker() {
      while (!state.stopRequested) {
        // JavaScript's single thread makes claiming the next index atomic here.
        const index = nextIndex++;
        if (index >= target.length) break;
        const item = target[index];
        // A chat can become current via SPA navigation after selection.
        if (item.id === initialActiveId || item.id === getActiveConversationId()) {
          skipped++;
          done++;
          state.selected.delete(item.id);
          renderMini(done, target.length, ok, failed, '현재 채팅 보호: 삭제 건너뜀');
          continue;
        }
        $('miniCurrent').textContent = `처리 중: ${item.title}`;
        try {
          await deleteOne(item.id);
          ok++;
          succeededIds.add(item.id);
          state.selected.delete(item.id);
        } catch (err) {
          failed++;
          failures.push(`${item.title}: ${errorMessage(err)}`);
          // Authentication errors normally mean subsequent requests would all fail.
          if (/HTTP 401|HTTP 403/.test(errorMessage(err))) state.stopRequested = true;
        } finally {
          done++;
          renderMini(done, target.length, ok, failed);
        }
        // Pace each worker without delaying the first request or the final result.
        if (!state.stopRequested && nextIndex < target.length) {
          await sleep(DELETE_DELAY_MS);
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(DELETE_CONCURRENCY, target.length) }, () => worker()));
    } finally {
      state.items = state.items.filter(item => !succeededIds.has(item.id));
      state.deleting = false;
      if (typeof updateEntryButtons === 'function') updateEntryButtons();
      state.lastFailed = failed;
      host.dataset.done = 'true';
      $('miniView').style.display = 'inline-flex';
      $('miniDismiss').style.display = 'inline-flex';
      renderList();
      $('reload').hidden = ok === 0;
      $('miniReload').style.display = 'inline-flex';
      if (state.stopRequested) {
        const remaining = target.length - done;
        $('miniTitle').textContent = '삭제 중지됨';
        $('miniCompactDone').textContent = `삭제 중지됨${failed ? ` · 실패 ${failed.toLocaleString()}` : ''}`;
        $('miniCurrent').textContent = `미처리 ${remaining}개 · 실패·미처리 항목 선택 유지`;
        setStatus(`중지됨 · 성공 ${ok}개 / 실패 ${failed}개 / 미처리 ${remaining}개. 실패·미처리 항목은 선택 상태로 남아 있습니다.`, failed ? 'error' : 'success');
      } else if (failed) {
        $('miniTitle').textContent = '삭제 완료 · 일부 실패';
        $('miniCompactDone').textContent = `삭제완료 · 실패 ${failed.toLocaleString()}`;
        $('miniCurrent').textContent = `실패한 ${failed}개 항목은 선택 상태로 유지`;
        setStatus(`완료 · 성공 ${ok}개 / 실패 ${failed}개. 실패한 항목은 선택 상태로 남아 있습니다. ${failures.slice(0, 2).join(' | ')}`, 'error');
      } else {
        $('miniTitle').textContent = '삭제 완료';
        $('miniCompactDone').textContent = '삭제완료';
        $('miniCurrent').textContent = skipped ? `현재 채팅 ${skipped}개 보호 · 삭제 건너뜀` : '목록 반영을 위해 페이지를 새로고침하세요.';
        setStatus(`${ok}개 삭제 완료${skipped ? ` · 현재 채팅 ${skipped}개 건너뜀` : ''}! 사이드바 반영을 위해 페이지를 새로고침하세요.`, 'success');
      }
      // Completion layout uses success/failure totals, not the in-progress fraction.
      // On mobile this text stays hidden in favor of the one-line compact status.
      $('miniCounts').textContent = `성공 ${ok.toLocaleString()} · 실패 ${failed.toLocaleString()}` +
        (state.stopRequested ? ` · 미처리 ${(target.length - done).toLocaleString()}` : '');
      refreshControls();
    }
  }

  function stopDelete() {
    if (!state.deleting) return;
    state.stopRequested = true;
    $('miniStop').disabled = true;
    $('miniStop').textContent = '중지 요청됨';
    $('miniCurrent').textContent = '진행 중인 요청이 끝나면 중지합니다.';
    refreshControls();
  }

  function togglePanel() {
    if (state.deleting) return;
    const isOpen = host.dataset.open === 'true';
    host.dataset.open = isOpen ? 'false' : 'true';
    if (!isOpen && !state.fetched && !state.loading) void loadConversations();
  }
  $('launcher').addEventListener('click', togglePanel);
  $('close').addEventListener('click', () => { if (!state.deleting) host.dataset.open = 'false'; });
  $('refresh').addEventListener('click', () => void loadConversations());
  $('search').addEventListener('input', event => {
    state.query = event.target.value;
    state.displayLimit = VISIBLE_INCREMENT;
    renderList();
  });
  $('selectFiltered').addEventListener('click', () => {
    if (state.loading || state.deleting) return;
    const activeId = getActiveConversationId();
    for (const item of filteredItems()) if (item.id !== activeId) state.selected.add(item.id);
    renderList();
  });
  $('unselectFiltered').addEventListener('click', () => {
    if (state.loading || state.deleting) return;
    for (const item of filteredItems()) state.selected.delete(item.id);
    renderList();
  });
  $('clear').addEventListener('click', () => {
    if (state.loading || state.deleting) return;
    state.selected.clear();
    renderList();
  });
  $('delete').addEventListener('click', openConfirm);
  $('cancelConfirm').addEventListener('click', closeConfirm);
  $('doDelete').addEventListener('click', () => void deleteSelected());
  $('stop').addEventListener('click', stopDelete);
  $('miniStop').addEventListener('click', stopDelete);
  $('miniView').addEventListener('click', () => {
    if (state.deleting) return;
    host.dataset.mini = 'false';
    host.dataset.done = 'false';
    host.dataset.open = 'true';
  });
  $('miniDismiss').addEventListener('click', () => {
    if (state.deleting) return;
    host.dataset.mini = 'false';
    host.dataset.done = 'false';
    host.dataset.open = 'false';
  });
  $('miniReload').addEventListener('click', () => location.reload());
  $('reload').addEventListener('click', () => location.reload());
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('confirm').dataset.show === 'true') closeConfirm();
    else if (!state.deleting) host.dataset.open = 'false';
  });

  // -----------------------------------------------------------------------
  // Native entry points only. Neither a floating launcher nor buttons on
  // individual conversation rows are wanted. SPA-safe and de-duplicated.
  // -----------------------------------------------------------------------
  const ACTION_ATTR = 'data-tm-chat-cleaner';
  const NAV_STYLE_ID = 'tm-chatgpt-cleaner-entry-style-v182';
  // Share is often rendered as an icon + visible "공유" text with NO
  // data-testid or aria-label. Detect the accessible label OR visible text.
  // Keep this independent of transient ChatGPT CSS class names.
  const SHARE_LABEL = /^(?:공유|공유하기|링크 공유|Share|Share chat|Share conversation|Share link)$/i;
  const SHARE_TEST_ID = /(?:^|[-_])share(?:[-_]chat)?[-_]button(?:$|[-_])/i;
  const ENTRY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="7" fill="#D1FAE5"/><path d="M7 8h8M7 12h6M7 16h7" stroke="#0F766E" stroke-width="2" stroke-linecap="round"/><path d="m15.4 15.7 1.6 1.6 3.1-3.4" stroke="#EA580C" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function ensureEntryStyle() {
    if (document.getElementById(NAV_STYLE_ID) || !document.head) return;
    const style = document.createElement('style');
    style.id = NAV_STYLE_ID;
    style.textContent = `
      button[${ACTION_ATTR}] {box-sizing:border-box!important;cursor:pointer!important;font-family:inherit!important;}
      /* Hide obsolete per-chat icons left behind by v1.7 in a still-open tab. */
      button[${ACTION_ATTR}="sidebar"] {display:none!important;}
      button[${ACTION_ATTR}="header"],button[${ACTION_ATTR}="recent"] {
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        flex:0 0 30px!important;width:30px!important;height:30px!important;
        min-width:30px!important;min-height:30px!important;max-width:30px!important;
        border:0!important;border-radius:8px!important;padding:3px!important;
        margin:0!important;background:transparent!important;color:inherit!important;
        line-height:1!important;vertical-align:middle!important;
      }
      button[${ACTION_ATTR}]:hover:not(:disabled) {background:var(--surface-hover,rgba(128,128,128,.12))!important;}
      button[${ACTION_ATTR}]:focus-visible {outline:2px solid #0d9488!important;outline-offset:1px!important;}
      button[${ACTION_ATTR}] svg {display:block!important;flex:none!important;width:20px!important;height:20px!important;}
      button[${ACTION_ATTR}]:disabled {opacity:.45!important;cursor:not-allowed!important;}
      @media (max-width:640px) {button[${ACTION_ATTR}="header"]{flex-basis:28px!important;min-width:28px!important;max-width:28px!important;width:28px!important;}}
    `;
    document.head.appendChild(style);
  }
  function newEntryButton(place) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(ACTION_ATTR, place);
    button.dataset.tmCleanerBuild = '1.8.2';
    button.title = '채팅 정리 · 선택 일괄 삭제';
    button.setAttribute('aria-label', '채팅 정리 창 열기');
    button.innerHTML = ENTRY_ICON; // icon only; never forces header to wrap
    button.disabled = state.deleting;
    for (const eventName of ['pointerdown','mousedown','mouseup']) {
      button.addEventListener(eventName, event => event.stopPropagation());
    }
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (!state.deleting) togglePanel();
    });
    return button;
  }
  function isDisplayed(node) {
    if (!node?.isConnected || node.closest('[role="menu"],[role="dialog"]')) return false;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }
  function shareButtonScore(node, rect) {
    const testId = node.getAttribute('data-testid') || '';
    const aria = (node.getAttribute('aria-label') || '').trim();
    const title = (node.getAttribute('title') || '').trim();
    const rawText = (node.innerText || node.textContent || '').trim().replace(/\s+/g, ' ');
    // Text can contain a decorative unicode share arrow. SVG is ignored by
    // textContent, so the common <button><svg/><span>공유</span></button> works.
    const caption = rawText.replace(/^[↗↥↑⤴⇧📤\s]+/u, '').trim();
    const hasTestId = SHARE_TEST_ID.test(testId);
    const hasAccessibleLabel = SHARE_LABEL.test(aria) || SHARE_LABEL.test(title);
    const hasVisibleCaption = SHARE_LABEL.test(caption);
    if (!hasTestId && !hasAccessibleLabel && !hasVisibleCaption) return -1;
    const inHeader = !!node.closest('header,#conversation-header-actions,#page-header,[data-testid*="header"],[data-testid*="topbar"]');
    // Use location as a safeguard against "share" buttons inside messages.
    // Right edge filter is deliberately lenient for narrow / responsive UI.
    if (rect.top < -8 || rect.top > 145 || rect.right < innerWidth * .43) return -1;
    return (hasTestId ? 8 : 0) + (hasAccessibleLabel ? 5 : 0) +
      (hasVisibleCaption ? 4 : 0) + (inHeader ? 3 : 0) +
      (rect.top < 82 ? 3 : 0);
  }
  function bestShareButton() {
    // The earlier build only supported [data-testid] / [aria-label] selectors,
    // so an ordinary native button labelled "공유" was missed entirely.
    const choices = [];
    for (const node of document.querySelectorAll('button,[role="button"]')) {
      if (node.hasAttribute(ACTION_ATTR) || !node.isConnected) continue;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.top < -8 || rect.top > 145 || rect.right < innerWidth * .43) continue;
      if (!isDisplayed(node)) continue;
      const score = shareButtonScore(node,rect);
      if (score >= 0) choices.push({node,score,rect});
    }
    // Prefer recognizable Share in native header, then the highest-right one.
    choices.sort((a,b)=> (b.score-a.score) || (a.rect.top-b.rect.top) || (b.rect.right-a.rect.right));
    return choices[0]?.node || null;
  }
  function recentLabelCandidates() {
    // No per-row conversation action: look for the "최근" section header.
    // Restrict to the left sidebar and exact title to avoid search/results.
    const scopes = [...document.querySelectorAll('nav,aside,#history,#sidebar,[data-testid*="sidebar"], [class*="sidebar"]')];
    const unique = new Set();
    const labels=[];
    const selector='h2,h3,h4,button,span,p,div';
    for (const scope of scopes.slice(0,35)) {
      for (const node of scope.querySelectorAll(selector)) {
        if (unique.has(node)) continue;
        unique.add(node);
        const txt = node.textContent?.trim();
        if (!/^(최근|Recent)$/i.test(txt || '')) continue;
        if (!isDisplayed(node)) continue;
        const r = node.getBoundingClientRect();
        if (r.left < -3 || r.left > Math.min(450,innerWidth*.56) || r.top < -5 || r.top >= innerHeight) continue;
        labels.push(node);
      }
    }
    labels.sort((a,b) => a.querySelectorAll('*').length-b.querySelectorAll('*').length);
    return labels;
  }
  function findRecentToolbar() {
    for (const label of recentLabelCandidates()) {
      const titleRect=label.getBoundingClientRect();
      let parent=label.parentElement;
      for (let depth=0; parent && depth<5; depth++,parent=parent.parentElement) {
        const pr=parent.getBoundingClientRect();
        if (pr.width > 550 || pr.height > 125) break;
        const buttons=[...parent.querySelectorAll('button,[role="button"]')].filter(btn => {
          if (btn.contains(label) || label.contains(btn) || btn.hasAttribute(ACTION_ATTR)) return false;
          const r=btn.getBoundingClientRect();
          // Icon group at the *right of the Recent heading*, same row.
          return r.width>0 && r.height>0 && r.left >= titleRect.right-3 &&
            Math.abs((r.top+r.height/2)-(titleRect.top+titleRect.height/2)) < 27;
        }).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
        if (buttons.length) {
          const first=buttons[0];
          // Insert into the toolbar's own parent, ahead of the first icon.
          // This inherits ChatGPT's hover visibility for that toolbar.
          if (first.parentElement && !first.parentElement.closest('button')) return first;
        }
      }
    }
    return null;
  }
  function updateEntryButtons() {
    for (const button of document.querySelectorAll(`button[${ACTION_ATTR}]`)) {
      button.disabled = state.deleting;
    }
    host.dataset.inline = 'true'; // remove floating fallback unconditionally
  }
  function syncEntryPoints() {
    ensureEntryStyle();
    // Obsolete per-chat icons are hidden by CSS if an older build is still active.
    const share=bestShareButton();
    const headerEntries=[...document.querySelectorAll(`button[${ACTION_ATTR}="header"]`)];
    if (share && share.parentElement && share.parentElement.tagName!=='BUTTON') {
      const compatible=headerEntries.find(node => node.dataset.tmCleanerBuild === '1.8.2');
      const entry=compatible || newEntryButton('header');
      // Use exactly one; discard old text-labelled copies.
      for (const duplicate of headerEntries) if (duplicate!==entry) duplicate.remove();
      // Add immediately to the LEFT of Share. The right edge often holds an
      // overflow menu; inserting after Share can push our icon out of view.
      if (share.previousElementSibling!==entry) share.insertAdjacentElement('beforebegin',entry);
    } else {
      for (const entry of headerEntries) entry.remove();
    }
    const toolbarButton=findRecentToolbar();
    const recentEntries=[...document.querySelectorAll(`button[${ACTION_ATTR}="recent"]`)];
    if (toolbarButton && toolbarButton.parentElement) {
      const entry=recentEntries.find(node => node.dataset.tmCleanerBuild === '1.8.2') || newEntryButton('recent');
      for (const duplicate of recentEntries) if (duplicate!==entry) duplicate.remove();
      if (toolbarButton.previousElementSibling!==entry) toolbarButton.insertAdjacentElement('beforebegin',entry);
    } else {
      for (const entry of recentEntries) entry.remove();
    }
    updateEntryButtons();
  }
  let syncTimer=null;
  function queueEntrySync() {
    if (syncTimer!==null) return;
    syncTimer=setTimeout(()=>{syncTimer=null;syncEntryPoints();},160);
  }
  syncEntryPoints();
  const entryObserver=new MutationObserver(queueEntrySync);
  entryObserver.observe(document.documentElement,{childList:true,subtree:true});
  // Some sidebar toolbars appear only on hover via CSS (no DOM mutation).
  // The capture listener refreshes the Recent action placement immediately.
  document.addEventListener('pointerover', event => {
    if (event.target instanceof Element && event.target.closest('nav,aside,#history,#sidebar,[data-testid*="sidebar"]')) queueEntrySync();
  }, true);
  document.addEventListener('focusin', event => {
    if (event.target instanceof Element && event.target.closest('nav,aside,#history,#sidebar,[data-testid*="sidebar"]')) queueEntrySync();
  }, true);
  setInterval(syncEntryPoints,4000);

  // pushState navigation does not dispatch popstate. Poll only the URL string,
  // not the server; this keeps the protected row current without extra API calls.
  let observedActiveId = getActiveConversationId();
  if (typeof window.setInterval === 'function') window.setInterval(() => {
    const now = getActiveConversationId();
    if (now === observedActiveId) return;
    observedActiveId = now;
    removeActiveFromSelection();
    if (host.dataset.open === 'true' && !state.deleting) renderList();
    else refreshControls();
  }, 1000);

  refreshControls();
})();
