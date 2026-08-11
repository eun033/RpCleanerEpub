// ==UserScript==
// @name         CrackSafe with EPUB
// @namespace    https://crack.wrtn.ai/
// @version      1.1.0
// @description  CrackSafe - 크랙 채팅 백업 및 EPUB 변환 기능 통합
// @author       zxklkj12 & eun033
// @match        https://crack.wrtn.ai/*
// @connect      crack-api.wrtn.ai
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @updateURL    https://gist.github.com/zxklkj12/8c10b4a97eb56e5d79b834339cdff5b4/raw/cracksafe.with.epub.user.js
// @downloadURL  https://gist.github.com/zxklkj12/8c10b4a97eb56e5d79b834339cdff5b4/raw/cracksafe.with.epub.user.js
// @require      https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @license      MIT
// ==/UserScript==
/*
CrackSafe 에 ePub 기능 추가
*/

(function() {
    'use strict';

    const CONFIG = {
        apiBase: 'https://crack-api.wrtn.ai/crack-gen/v3',
        storageKey: 'HCD_lastTurnCount',
        historyKey: 'HCD_downloadHistory',
        cursorKey: 'HCD_saveCursors',
        incrFormatKey: 'HCD_incrFormat',
        clipboardKey: 'HCD_clipboardOn',
        siteOptionButtonKey: 'HCD_siteDownloadSidebarOn_v2',
        cleanerOptionsKey: 'HCD_logCleanerOptions_v1',
        retryCount: 3,
        retryBaseDelay: 1500,
        chunkSize: 300,
        incrChunkSize: 50,
        hardLimit: 20000,
        maxHistoryItems: 200,
    };

    const ICONS = {
        download: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        note: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
        edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
        disk: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
        spinner: `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        menu: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
        bookmark: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        highlight: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
        settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        sidebar: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
        pencil: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
        search: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        moon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
        sun: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
        forward: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`,
        play: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
        stop: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
    };

    const styles = `
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css');
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap');
        .hcd-input[type=number]::-webkit-outer-spin-button,.hcd-input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}.hcd-input[type=number]{-moz-appearance:textfield}
        .hcd-ctrl-bar{display:none;align-items:center;gap:10px;margin-top:20px;padding:14px;background:var(--hcd-surface);border:1px solid var(--hcd-border);border-radius:14px}
        .hcd-ctrl-bar.active{display:flex}
        .hcd-ctrl-progress{flex:1;min-width:0}
        .hcd-ctrl-text{font-size:13px;font-weight:600;color:var(--hcd-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-ctrl-sub{font-size:11px;color:var(--hcd-text3);margin-top:2px}
        .hcd-stop-btn{width:44px;height:44px;border-radius:12px;border:none;background:var(--hcd-danger);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.2s}.hcd-stop-btn:hover{opacity:.85}
        .hcd-play-btn{width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--hcd-accent),var(--hcd-accent2));color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px var(--hcd-accent-glow);transition:all .25s;min-height:48px}
        .hcd-play-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px var(--hcd-accent-glow)}
        .hcd-play-btn:disabled{opacity:.4;cursor:default;transform:none}
        .hcd-play-btn.danger{background:linear-gradient(135deg,var(--hcd-danger),#ef4444);box-shadow:0 4px 14px rgba(220,38,38,.2)}
        .hcd-clip-row{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 14px;background:var(--hcd-surface);border:1px solid var(--hcd-border2);border-radius:10px;cursor:pointer;transition:.15s;-webkit-tap-highlight-color:transparent}
        .hcd-clip-row:hover{background:var(--hcd-accent-soft)}
        .hcd-clip-cb{width:18px;height:18px;accent-color:var(--hcd-accent);cursor:pointer;flex-shrink:0;margin:0}
        .hcd-clip-label{font-size:12px;font-weight:600;color:var(--hcd-text2);flex:1}
        .hcd-clip-hint{font-size:10px;color:var(--hcd-text4)}
        .hcd-cleaner-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
        .hcd-cleaner-row{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:1px solid var(--hcd-border2);border-radius:10px;background:var(--hcd-surface2);cursor:pointer;-webkit-tap-highlight-color:transparent}
        .hcd-cleaner-row input{width:18px;height:18px;margin:1px 0 0 0;accent-color:var(--hcd-accent);flex:0 0 auto}
        .hcd-cleaner-name{font-size:12px;font-weight:800;color:var(--hcd-text2);line-height:1.35}
        .hcd-cleaner-help{font-size:11px;color:var(--hcd-text4);line-height:1.45;margin-top:2px}
        .hcd-cleaner-select-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:8px 10px;border:1px solid var(--hcd-border2);border-radius:10px;background:var(--hcd-surface2)}
        .hcd-cleaner-select-row span{font-size:12px;font-weight:800;color:var(--hcd-text2)}
        :root{--hcd-bg:rgba(255,255,255,.98);--hcd-bg2:linear-gradient(160deg,rgba(255,255,255,.98),rgba(248,249,250,.98));--hcd-surface:rgba(0,0,0,.03);--hcd-surface2:rgba(0,0,0,.02);--hcd-border:rgba(0,0,0,.08);--hcd-border2:rgba(0,0,0,.05);--hcd-text:#000000;--hcd-text2:#1a1a1a;--hcd-text3:#333333;--hcd-text4:#555555;--hcd-accent:#2563eb;--hcd-accent2:#3b82f6;--hcd-accent-glow:rgba(37,99,235,.2);--hcd-accent-soft:rgba(37,99,235,.08);--hcd-accent-text:#1d4ed8;--hcd-accent-text2:#93c5fd;--hcd-danger:#dc2626;--hcd-danger-soft:rgba(239,68,68,.06);--hcd-danger-text:#dc2626;--hcd-overlay:rgba(0,0,0,.3);--hcd-fab-bg:linear-gradient(135deg,#fff,#f8f9fa);--hcd-fab-color:#2563eb;--hcd-fab-shadow:0 8px 32px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06);--hcd-fab-hover-shadow:0 12px 40px rgba(0,0,0,.18),0 0 20px rgba(37,99,235,.1);--hcd-panel-shadow:0 25px 60px rgba(0,0,0,.15),0 0 0 1px rgba(0,0,0,.06);--hcd-tab-active-bg:rgba(37,99,235,.08);--hcd-tab-active-color:#2563eb;--hcd-tab-active-shadow:0 0 12px rgba(37,99,235,.06);--hcd-btn-sec-bg:rgba(0,0,0,.04);--hcd-btn-sec-color:#495057;--hcd-btn-sec-border:rgba(0,0,0,.08);--hcd-input-bg:rgba(0,0,0,.02);--hcd-input-focus:rgba(37,99,235,.15);--hcd-incr-bg:rgba(37,99,235,.04);--hcd-incr-border:rgba(37,99,235,.1);--hcd-incr-text:#1d4ed8;--hcd-incr-strong:#1e40af;--hcd-tag-html-bg:rgba(59,130,246,.08);--hcd-tag-html:#2563eb;--hcd-tag-txt-bg:rgba(0,0,0,.04);--hcd-tag-txt:#6b7280;--hcd-tag-json-bg:rgba(34,197,94,.06);--hcd-tag-json:#16a34a;--hcd-tag-incr-bg:rgba(217,119,6,.06);--hcd-tag-incr:#d97706;--hcd-close-hover:rgba(239,68,68,.06);--hcd-close-hover-color:#ef4444;--hcd-warn-bg:rgba(239,68,68,.04);--hcd-warn-border:rgba(239,68,68,.1);--hcd-warn-text:#ef4444;--hcd-status-ok:#16a34a;--hcd-status-err:#dc2626;--hcd-grp-cnt-bg:rgba(0,0,0,.04);--hcd-scroll-thumb:rgba(0,0,0,.1);--hcd-rename-hover-bg:rgba(37,99,235,.06);--hcd-rename-hover-color:#2563eb}
        @media(prefers-color-scheme:dark){:root{--hcd-bg:rgba(22,22,35,.97);--hcd-bg2:linear-gradient(160deg,rgba(22,22,35,.97),rgba(15,15,25,.98));--hcd-surface:rgba(255,255,255,.04);--hcd-surface2:rgba(255,255,255,.02);--hcd-border:rgba(255,255,255,.08);--hcd-border2:rgba(255,255,255,.04);--hcd-text:#ffffff;--hcd-text2:#f0f0f3;--hcd-text3:#b0b5bd;--hcd-text4:#8a8f99;--hcd-accent:#3b82f6;--hcd-accent2:#60a5fa;--hcd-accent-glow:rgba(37,99,235,.25);--hcd-accent-soft:rgba(126,184,255,.12);--hcd-accent-text:#7eb8ff;--hcd-accent-text2:#93c5fd;--hcd-danger:#ef4444;--hcd-danger-soft:rgba(239,68,68,.1);--hcd-danger-text:#f87171;--hcd-overlay:rgba(0,0,0,.6);--hcd-fab-bg:linear-gradient(135deg,#0f0f0f,#1a1a2e);--hcd-fab-color:#7eb8ff;--hcd-fab-shadow:0 8px 32px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.05) inset;--hcd-fab-hover-shadow:0 12px 40px rgba(0,0,0,.4),0 0 20px rgba(126,184,255,.15);--hcd-panel-shadow:0 25px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06) inset;--hcd-tab-active-bg:rgba(126,184,255,.12);--hcd-tab-active-color:#7eb8ff;--hcd-tab-active-shadow:0 0 12px rgba(126,184,255,.08);--hcd-btn-sec-bg:rgba(255,255,255,.06);--hcd-btn-sec-color:#9ca3af;--hcd-btn-sec-border:rgba(255,255,255,.08);--hcd-input-bg:rgba(255,255,255,.04);--hcd-input-focus:rgba(126,184,255,.15);--hcd-incr-bg:rgba(126,184,255,.06);--hcd-incr-border:rgba(126,184,255,.12);--hcd-incr-text:#93c5fd;--hcd-incr-strong:#a5d4ff;--hcd-tag-html-bg:rgba(59,130,246,.15);--hcd-tag-html:#60a5fa;--hcd-tag-txt-bg:rgba(255,255,255,.06);--hcd-tag-txt:#9ca3af;--hcd-tag-json-bg:rgba(34,197,94,.12);--hcd-tag-json:#4ade80;--hcd-tag-incr-bg:rgba(251,191,36,.1);--hcd-tag-incr:#fbbf24;--hcd-close-hover:rgba(255,80,80,.1);--hcd-close-hover-color:#ff6b6b;--hcd-warn-bg:rgba(239,68,68,.08);--hcd-warn-border:rgba(239,68,68,.15);--hcd-warn-text:#fca5a5;--hcd-status-ok:#4ade80;--hcd-status-err:#f87171;--hcd-grp-cnt-bg:rgba(255,255,255,.05);--hcd-scroll-thumb:rgba(255,255,255,.1);--hcd-rename-hover-bg:rgba(96,165,250,.1);--hcd-rename-hover-color:#60a5fa}}
        .hcd-fab{position:fixed;bottom:140px;right:16px;width:52px;height:52px;border-radius:16px;background:var(--hcd-fab-bg);border:1px solid var(--hcd-border);box-shadow:var(--hcd-fab-shadow);cursor:grab;display:flex;align-items:center;justify-content:center;z-index:9999;color:var(--hcd-fab-color);-webkit-tap-highlight-color:transparent;touch-action:none;user-select:none;-webkit-user-select:none}
        @media(min-width:769px){.hcd-fab{right:auto;left:20px;bottom:80px}}
        .hcd-fab:active{cursor:grabbing}
        .hcd-panel-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:var(--hcd-overlay);z-index:10000;display:flex;align-items:center;justify-content:center;opacity:0;animation:hcdFadeIn .25s cubic-bezier(.4,0,.2,1) forwards}
        .hcd-panel{background:var(--hcd-bg2);width:90%;max-width:460px;border-radius:20px;padding:28px;box-shadow:var(--hcd-panel-shadow);font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,sans-serif;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;color:var(--hcd-text2);scrollbar-width:thin;scrollbar-color:var(--hcd-scroll-thumb) transparent}
        .hcd-panel::-webkit-scrollbar{width:6px}.hcd-panel::-webkit-scrollbar-track{background:transparent}.hcd-panel::-webkit-scrollbar-thumb{background:var(--hcd-scroll-thumb);border-radius:3px}
        .hcd-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .hcd-title{font-size:19px;font-weight:600;color:var(--hcd-text);letter-spacing:-.01em;font-family:'Playfair Display',Georgia,serif}
        .hcd-close-btn{background:var(--hcd-surface);border:1px solid var(--hcd-border);border-radius:10px;cursor:pointer;color:var(--hcd-text3);padding:8px;min-width:40px;min-height:40px;display:flex;align-items:center;justify-content:center;transition:.2s}
        .hcd-close-btn:hover{background:var(--hcd-close-hover);color:var(--hcd-close-hover-color);border-color:var(--hcd-close-hover)}
        .hcd-tabs{display:flex;background:var(--hcd-surface);padding:4px;border-radius:14px;margin-bottom:24px;border:1px solid var(--hcd-border)}
        .hcd-tab{flex:1;padding:10px 6px;border:none;background:none;border-radius:11px;font-weight:600;color:var(--hcd-text3);cursor:pointer;transition:all .25s cubic-bezier(.4,0,.2,1);font-size:13px;min-height:42px;white-space:nowrap;font-family:inherit}
        .hcd-tab.active{background:var(--hcd-tab-active-bg);color:var(--hcd-tab-active-color);box-shadow:var(--hcd-tab-active-shadow)}
        .hcd-tab:hover:not(.active){color:var(--hcd-text2)}
        .hcd-content{display:none}.hcd-content.active{display:block}.hcd-option-card{background:var(--hcd-surface2);border:1px solid var(--hcd-border);border-radius:14px;padding:14px;margin-bottom:12px}.hcd-option-title{font-size:14px;font-weight:800;color:var(--hcd-text);margin-bottom:6px}.hcd-option-desc{font-size:12px;line-height:1.55;color:var(--hcd-text3);margin-bottom:12px}.hcd-toggle-row{display:flex;align-items:center;gap:12px;min-height:48px;cursor:pointer;-webkit-tap-highlight-color:transparent}.hcd-toggle-row input{display:none}.hcd-switch{width:46px;height:26px;border-radius:999px;background:var(--hcd-border);position:relative;flex:0 0 46px;transition:.2s}.hcd-switch:before{content:'';position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:.2s}.hcd-toggle-row input:checked+.hcd-switch{background:var(--hcd-accent)}.hcd-toggle-row input:checked+.hcd-switch:before{transform:translateX(20px)}.hcd-toggle-text{font-size:13px;font-weight:700;color:var(--hcd-text2)}.hcd-toggle-sub{font-size:11px;color:var(--hcd-text4);margin-top:2px}.hcd-fab.hcd-hidden-by-sidebar{display:none!important}
        .hcd-site-download-entry{cursor:pointer!important;-webkit-tap-highlight-color:transparent}
        .hcd-site-download-entry:hover{background:rgba(127,127,127,.08)}
        .hcd-site-download-button{width:100%;display:flex!important;height:16px!important;align-items:center!important;justify-content:space-between!important}
        .hcd-site-download-left{display:flex!important;align-items:center!important}
        .hcd-site-download-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex:0 0 24px;color:var(--icon_secondary,#85837d)!important}
        .hcd-site-download-icon svg{width:24px!important;height:24px!important;color:inherit!important;stroke:currentColor!important;stroke-width:2!important}
        .hcd-site-download-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit!important;font-size:14px!important;font-weight:500!important;line-height:14px!important;margin-left:8px!important;letter-spacing:inherit!important}
        .hcd-site-download-badge{margin-left:auto!important;min-width:30px;height:18px;border-radius:999px;font-size:10px;font-weight:900;display:none;align-items:center;justify-content:center;padding:0 6px;line-height:1;color:#fff;background:#22c55e;flex:0 0 auto}
        .hcd-site-download-badge.fresh,.hcd-site-download-badge.warn,.hcd-site-download-badge.old{display:flex}
        .hcd-site-download-badge.fresh{background:#22c55e}.hcd-site-download-badge.warn{background:#f59e0b}.hcd-site-download-badge.old{background:#ef4444}
        .hcd-form-group{margin-bottom:18px}
        .hcd-label{display:block;font-size:12px;font-weight:600;color:var(--hcd-text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
        .hcd-input{width:100%;padding:12px 14px;border:1px solid var(--hcd-border);border-radius:12px;font-size:16px;box-sizing:border-box;-webkit-appearance:none;background:var(--hcd-input-bg);color:var(--hcd-text);font-family:inherit;transition:.2s}
        .hcd-input:focus{border-color:var(--hcd-accent);outline:none;box-shadow:0 0 0 3px var(--hcd-input-focus)}
        .hcd-select{padding:10px 12px;border:1px solid var(--hcd-border);border-radius:10px;font-size:14px;font-weight:600;background:var(--hcd-input-bg);color:var(--hcd-text2);cursor:pointer;outline:none;min-height:40px;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;font-family:inherit;transition:.2s}
        .hcd-select:focus{border-color:var(--hcd-accent);box-shadow:0 0 0 3px var(--hcd-input-focus)}
        .hcd-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:20px}
        .hcd-btn{padding:12px 10px;border:none;border-radius:12px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,var(--hcd-accent),var(--hcd-accent2));color:#fff;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;transition:all .25s cubic-bezier(.4,0,.2,1);min-height:46px;-webkit-tap-highlight-color:transparent;font-family:inherit;box-shadow:0 4px 14px var(--hcd-accent-glow);letter-spacing:-.01em}
        .hcd-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px var(--hcd-accent-glow)}.hcd-btn:active{transform:scale(.97)}
        .hcd-btn.secondary{background:var(--hcd-btn-sec-bg);color:var(--hcd-btn-sec-color);box-shadow:none;border:1px solid var(--hcd-btn-sec-border)}
        .hcd-btn.secondary:hover{background:var(--hcd-accent-soft);color:var(--hcd-accent-text);transform:translateY(-1px)}
        .hcd-status{margin-top:14px;font-size:12px;color:var(--hcd-text3);text-align:center;min-height:20px}
        .hcd-warning{background:var(--hcd-warn-bg);border:1px solid var(--hcd-warn-border);padding:14px;border-radius:12px;font-size:12px;color:var(--hcd-warn-text);line-height:1.6;margin-bottom:16px}
        .hcd-incr-box{background:var(--hcd-incr-bg);border:1px solid var(--hcd-incr-border);padding:16px;border-radius:14px;margin-bottom:18px;font-size:13px;line-height:1.6;color:var(--hcd-incr-text)}
        .hcd-incr-box strong{font-weight:700;color:var(--hcd-incr-strong)}
        .hcd-incr-row{display:flex;gap:8px;margin-top:12px;align-items:center}
        .hcd-incr-btn{flex:1;background:linear-gradient(135deg,#1d4ed8,var(--hcd-accent));color:white;border:none;padding:10px 12px;border-radius:10px;font-weight:700;cursor:pointer;min-height:44px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;box-shadow:0 4px 14px rgba(29,78,216,.25);transition:all .25s}
        .hcd-incr-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(29,78,216,.35)}
        .hcd-history-list{max-height:350px;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:var(--hcd-scroll-thumb) transparent}
        .hcd-history-list::-webkit-scrollbar{width:5px}.hcd-history-list::-webkit-scrollbar-track{background:transparent}.hcd-history-list::-webkit-scrollbar-thumb{background:var(--hcd-scroll-thumb);border-radius:3px}
        .hcd-history-group{margin-bottom:12px;border:1px solid var(--hcd-border);border-radius:14px;overflow:hidden;background:var(--hcd-surface2)}
        .hcd-history-group-header{display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--hcd-surface);border-bottom:1px solid var(--hcd-border2);cursor:pointer;min-height:46px;transition:.15s}
        .hcd-history-group-header:hover{background:var(--hcd-accent-soft)}
        .hcd-history-group-name{flex:1;font-weight:700;font-size:13px;color:var(--hcd-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-history-group-count{font-size:11px;color:var(--hcd-text4);flex-shrink:0;background:var(--hcd-grp-cnt-bg);padding:2px 8px;border-radius:6px}
        .hcd-history-group-incr{background:linear-gradient(135deg,#1d4ed8,var(--hcd-accent));color:white;border:none;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;min-height:30px;display:flex;align-items:center;gap:4px;font-family:inherit;box-shadow:0 2px 8px rgba(29,78,216,.2);transition:.2s}
        .hcd-history-group-incr:hover{box-shadow:0 4px 12px rgba(29,78,216,.3)}
        .hcd-history-group-body{max-height:0;overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1)}
        .hcd-history-group.open .hcd-history-group-body{max-height:2000px}
        .hcd-history-item{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--hcd-border2);font-size:13px;transition:.15s}
        .hcd-history-item:last-child{border-bottom:none}
        .hcd-history-item:hover{background:var(--hcd-surface)}
        .hcd-history-type{font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;flex-shrink:0;text-transform:uppercase;letter-spacing:.04em}
        .hcd-history-type.html{background:var(--hcd-tag-html-bg);color:var(--hcd-tag-html)}.hcd-history-type.txt{background:var(--hcd-tag-txt-bg);color:var(--hcd-tag-txt)}.hcd-history-type.json{background:var(--hcd-tag-json-bg);color:var(--hcd-tag-json)}.hcd-history-type.incr{background:var(--hcd-tag-incr-bg);color:var(--hcd-tag-incr)}
        .hcd-history-info{flex:1;min-width:0}
        .hcd-history-name{font-size:12px;color:var(--hcd-text3);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-history-meta{font-size:11px;color:var(--hcd-text4)}

        .hcd-history-rename, .hcd-history-copy {background:none;border:none;color:var(--hcd-text4);cursor:pointer;padding:4px;min-width:28px;min-height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:8px;transition:.2s}
        .hcd-history-rename:hover{color:var(--hcd-rename-hover-color);background:var(--hcd-rename-hover-bg)}
        .hcd-history-copy:hover{color:var(--hcd-accent-text);background:var(--hcd-accent-soft)}

        .hcd-history-group-cb{width:18px;height:18px;accent-color:var(--hcd-accent);cursor:pointer;flex-shrink:0;display:none;margin-right:8px;}
        .hcd-history-editing .hcd-history-group-cb{display:block;}

        .hcd-history-cb{width:18px;height:18px;accent-color:var(--hcd-accent);cursor:pointer;flex-shrink:0;display:none}
        .hcd-history-editing .hcd-history-cb{display:block}
        .hcd-history-editing .hcd-history-group-incr{display:none}
        .hcd-history-editing .hcd-history-rename, .hcd-history-editing .hcd-history-copy {display:none}
        .hcd-history-empty{text-align:center;padding:40px 20px;color:var(--hcd-text4);font-size:13px}
        .hcd-history-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:8px;flex-wrap:wrap}
        .hcd-history-count{font-size:12px;color:var(--hcd-text4)}
        .hcd-htool-btn{background:var(--hcd-surface);border:1px solid var(--hcd-border);color:var(--hcd-text3);padding:5px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;min-height:30px;transition:.2s;font-family:inherit}.hcd-htool-btn:hover{background:var(--hcd-accent-soft);color:var(--hcd-accent-text)}
        .hcd-htool-btn.danger{border-color:var(--hcd-warn-border);color:var(--hcd-danger-text)}.hcd-htool-btn.danger:hover{background:var(--hcd-danger-soft)}
        .hcd-htool-btn.primary{border-color:var(--hcd-incr-border);color:var(--hcd-accent-text)}.hcd-htool-btn.primary:hover{background:var(--hcd-accent-soft)}
        .hcd-htool-actions{display:none;gap:6px;align-items:center}.hcd-history-editing .hcd-htool-actions{display:flex}
        .hcd-htool-normal{display:flex;gap:6px;align-items:center}.hcd-history-editing .hcd-htool-normal{display:none}
        .hcd-backup-bar{display:flex;gap:8px;margin-bottom:16px;padding:14px;background:var(--hcd-surface2);border:1px solid var(--hcd-border);border-radius:14px;align-items:center}
        .hcd-backup-bar span{font-size:12px;font-weight:700;color:var(--hcd-text3);flex-shrink:0}
        .hcd-backup-btn{flex:1;padding:9px 6px;border:1px solid var(--hcd-border);border-radius:10px;background:var(--hcd-surface);color:var(--hcd-text3);font-size:12px;font-weight:600;cursor:pointer;min-height:38px;display:flex;align-items:center;justify-content:center;gap:4px;transition:.2s;font-family:inherit}
        .hcd-backup-btn:hover{background:var(--hcd-accent-soft);border-color:var(--hcd-incr-border);color:var(--hcd-accent-text)}
        .hcd-backup-btn.import{border-style:dashed}
        .hcd-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid var(--hcd-bg);line-height:1;pointer-events:none;transition:.3s}
        .hcd-badge.fresh{background:#22c55e;color:#fff}.hcd-badge.warn{background:#f59e0b;color:#fff}.hcd-badge.old{background:#ef4444;color:#fff}.hcd-badge.hide{display:none}
        .hcd-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px}
        .hcd-stat{background:var(--hcd-surface);border:1px solid var(--hcd-border2);border-radius:10px;padding:10px 12px;text-align:center}
        .hcd-stat-val{font-size:18px;font-weight:700;color:var(--hcd-text);letter-spacing:-.02em}
        .hcd-stat-label{font-size:10px;font-weight:600;color:var(--hcd-text4);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
        .hcd-hsearch{display:flex;gap:8px;margin-bottom:12px;align-items:center}
        .hcd-hsearch-input{flex:1;padding:8px 12px;border:1px solid var(--hcd-border);border-radius:10px;font-size:13px;background:var(--hcd-input-bg);color:var(--hcd-text);font-family:inherit;outline:none;transition:.2s;min-height:36px}.hcd-hsearch-input:focus{border-color:var(--hcd-accent)}
        .hcd-hsearch-input::placeholder{color:var(--hcd-text4)}
        .hcd-batch-btn{width:100%;margin-bottom:14px;padding:10px;background:var(--hcd-surface);border:1px solid var(--hcd-incr-border);border-radius:10px;color:var(--hcd-accent-text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;transition:.2s;min-height:40px}.hcd-batch-btn:hover{background:var(--hcd-accent-soft)}
        .hcd-batch-btn:disabled{opacity:.4;cursor:default}
        .hcd-merge-zone{border:2px dashed var(--hcd-border);border-radius:14px;padding:24px 16px;text-align:center;cursor:pointer;transition:.2s;margin-bottom:16px}
        .hcd-merge-zone:hover{border-color:var(--hcd-accent);background:var(--hcd-accent-soft)}
        .hcd-merge-zone-text{font-size:13px;color:var(--hcd-text3);line-height:1.6}
        .hcd-merge-zone-text strong{color:var(--hcd-text2)}
        .hcd-merge-list{max-height:180px;overflow-y:auto;margin-bottom:14px;scrollbar-width:thin;scrollbar-color:var(--hcd-scroll-thumb) transparent}
        .hcd-merge-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--hcd-border2);border-radius:8px;margin-bottom:6px;font-size:12px;color:var(--hcd-text2)}
        .hcd-merge-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hcd-merge-item-size{color:var(--hcd-text4);font-size:11px;flex-shrink:0}
        .hcd-merge-item-del{background:none;border:none;color:var(--hcd-text4);cursor:pointer;font-size:14px;padding:2px 4px;border-radius:4px;flex-shrink:0}.hcd-merge-item-del:hover{color:var(--hcd-danger-text)}
        @keyframes hcdFadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}.spin{animation:spin 1s linear infinite}@keyframes spin{100%{transform:rotate(360deg)}}
    `;

    const Platform = {
        async download(content, fileName, mime) {
            const fullMime = (mime.startsWith('text/') || mime === 'application/json') ? `${mime};charset=utf-8` : mime;
            const blob = new Blob([content], { type: fullMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = fileName; a.style.display = 'none';
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
        }
    };

    const Clipboard = {
        isOn() { try { return localStorage.getItem(CONFIG.clipboardKey) === '1'; } catch { return false; } },
        setOn(v) { try { localStorage.setItem(CONFIG.clipboardKey, v ? '1' : '0'); } catch {} },
        async copyWithPromise(contentFn) {
            if (!navigator.clipboard?.write) {
                const text = await contentFn();
                return this._fallbackCopy(text);
            }
            let resolveText;
            const textPromise = new Promise(r => { resolveText = r; });
            const item = new ClipboardItem({ 'text/plain': textPromise.then(t => new Blob([t], { type: 'text/plain;charset=utf-8' })) });
            const writePromise = navigator.clipboard.write([item]);
            try {
                const text = await contentFn();
                resolveText(text);
                await writePromise;
                return true;
            } catch (e) {
                console.warn('[HCD] clipboard.write 실패, 폴백 시도:', e);
                try { const text = await contentFn(); return this._fallbackCopy(text); }
                catch { return false; }
            }
        },
        async copy(text) {
            try {
                if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
                return this._fallbackCopy(text);
            } catch { return this._fallbackCopy(text); }
        },
        _fallbackCopy(text) {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); return true; }
            catch { return false; }
            finally { document.body.removeChild(ta); }
        }
    };

    const History = {
        _load() { try { return JSON.parse(localStorage.getItem(CONFIG.historyKey) || '[]'); } catch { return []; } },
        _save(list) { try { localStorage.setItem(CONFIG.historyKey, JSON.stringify(list)); } catch {} },
        getAll() { return this._load(); },

        add(entry) {
            const list = this._load();
            list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), timestamp: new Date().toISOString(), ...entry });
            if (list.length > CONFIG.maxHistoryItems) list.length = CONFIG.maxHistoryItems;
            this._save(list);
        },

        rename(id, newName) {
            const list = this._load();
            const item = list.find(h => h.id === id);
            if (item) { item.label = newName; this._save(list); }
        },

        _rebuildCursorsAfterDelete(affectedChatroomIds) {
            const list = this._load();
            for (const crid of affectedChatroomIds) {
                if (crid === '_full_backup_') continue;
                const remaining = list.filter(h => h.chatroomId === crid && h.lastMessageId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (remaining.length > 0) {
                    const latest = remaining[0];
                    let total = 0;
                    const sorted = remaining.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    for (const r of sorted) total = r.incremental ? total + (r.messageCount || 0) : (r.messageCount || 0);
                    this.setCursor(crid, { lastMessageId: latest.lastMessageId, totalSaved: total, savedAt: latest.timestamp, charName: latest.charName });
                } else {
                    this.removeCursor(crid);
                }
            }
        },

        remove(id) {
            const list = this._load();
            const target = list.find(h => h.id === id);
            const crid = target?.chatroomId;
            this._save(list.filter(h => h.id !== id));
            if (crid) this._rebuildCursorsAfterDelete([crid]);
        },

        removeMany(ids) {
            const set = new Set(ids);
            const list = this._load();
            const affected = new Set(list.filter(h => set.has(h.id)).map(h => h.chatroomId).filter(Boolean));
            this._save(list.filter(h => !set.has(h.id)));
            this._rebuildCursorsAfterDelete(affected);
        },

        clear() { this._save([]); const c = this._loadCursors(); for (const k in c) delete c[k]; this._saveCursors(c); },

        _loadCursors() { try { return JSON.parse(localStorage.getItem(CONFIG.cursorKey) || '{}'); } catch { return {}; } },
        _saveCursors(obj) { try { localStorage.setItem(CONFIG.cursorKey, JSON.stringify(obj)); } catch {} },
        getCursor(chatroomId) { return this._loadCursors()[chatroomId] || null; },
        setCursor(chatroomId, data) { const c = this._loadCursors(); c[chatroomId] = data; this._saveCursors(c); },
        removeCursor(chatroomId) { const c = this._loadCursors(); delete c[chatroomId]; this._saveCursors(c); },

        getGrouped() {
            const items = this._load().filter(h => h.chatroomId !== '_full_backup_' && h.type !== 'full');
            const groups = new Map();
            for (const h of items) {
                const key = h.chatroomId || '_unknown_';
                if (!groups.has(key)) groups.set(key, { charName: h.charName || '알 수 없음', chatroomId: key, items: [] });
                groups.get(key).items.push(h);
            }
            return [...groups.values()];
        },

        getIncrFormat() { try { return localStorage.getItem(CONFIG.incrFormatKey) || 'txt'; } catch { return 'txt'; } },
        setIncrFormat(f) { try { localStorage.setItem(CONFIG.incrFormatKey, f); } catch {} },

        getStats() {
            const items = this._load().filter(h => h.chatroomId !== '_full_backup_' && h.type !== 'full');
            const cursors = this._loadCursors();
            const cursorEntries = Object.entries(cursors).filter(([k]) => k !== '_full_backup_');
            let totalMessages = 0, totalSaves = items.length;
            const charNames = new Set();
            let lastSaveAt = null;
            for (const h of items) {
                totalMessages += h.messageCount || 0;
                if (h.charName && h.chatroomId !== '_full_backup_') charNames.add(h.charName);
                if (!lastSaveAt || new Date(h.timestamp) > new Date(lastSaveAt)) lastSaveAt = h.timestamp;
            }
            return { totalSaves, totalMessages, charCount: charNames.size, cursorCount: cursorEntries.length, lastSaveAt };
        },

        getAllCursors() {
            const cursors = this._loadCursors();
            return Object.entries(cursors).filter(([k]) => k !== '_full_backup_').map(([chatroomId, data]) => ({ chatroomId, ...data }));
        },

        exportBackup() {
            const payload = {
                _hcdBackup: true,
                version: '1.0.3',
                exportedAt: new Date().toISOString(),
                history: this._load(),
                cursors: this._loadCursors(),
                incrFormat: this.getIncrFormat(),
                lastTurnCount: localStorage.getItem(CONFIG.storageKey) || '100',
            };
            return JSON.stringify(payload, null, 2);
        },

        importBackup(jsonStr, overwrite = false) {
            const data = JSON.parse(jsonStr);
            if (!data._hcdBackup) throw new Error('유효한 백업 파일이 아닙니다.');
            if (overwrite) {
                this._save(data.history || []);
                this._saveCursors(data.cursors || {});
            } else {
                const existing = this._load();
                const existingIds = new Set(existing.map(h => h.id));
                const newItems = (data.history || []).filter(h => !existingIds.has(h.id));
                this._save([...existing, ...newItems]);

                const existingCursors = this._loadCursors();
                const importedCursors = data.cursors || {};
                for (const [k, v] of Object.entries(importedCursors)) {
                    if (!existingCursors[k] || new Date(v.savedAt) > new Date(existingCursors[k].savedAt)) {
                        existingCursors[k] = v;
                    }
                }
                this._saveCursors(existingCursors);
            }
            if (data.incrFormat) this.setIncrFormat(data.incrFormat);
            if (data.lastTurnCount) { try { localStorage.setItem(CONFIG.storageKey, data.lastTurnCount); } catch {} }
            return { historyCount: (data.history || []).length, cursorCount: Object.keys(data.cursors || {}).length };
        },
    };

    const API = {
        getCookie(name) { const v = `; ${document.cookie}`; const p = v.split(`; ${name}=`); return p.length === 2 ? decodeURIComponent(p.pop().split(';').shift()) : null; },
        getUrlInfo() { const m = window.location.pathname.match(/\/stories\/([a-f0-9]+)\/episodes\/([a-f0-9]+)/); return m ? { characterId: m[1], chatroomId: m[2] } : null; },
        _rawRequest(endpoint) {
            const token = this.getCookie('access_token'); if (!token) throw new Error('로그인이 필요합니다.');
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({ method: 'GET', url: `${CONFIG.apiBase}${endpoint}`, headers: { 'Authorization': `Bearer ${token}`, 'platform': 'web' },
                    onload: (res) => { if (res.status >= 200 && res.status < 300) { try { resolve(JSON.parse(res.responseText)); } catch { reject(new Error('JSON 파싱 실패')); } } else if (res.status === 429) reject(new Error('RATE_LIMITED')); else reject(new Error(`API 오류: ${res.status}`)); },
                    onerror: () => reject(new Error('네트워크 오류'))
                });
            });
        },
        async request(endpoint) {
            let lastError;
            for (let attempt = 0; attempt < CONFIG.retryCount; attempt++) {
                try { return await this._rawRequest(endpoint); } catch (e) { lastError = e; if (attempt < CONFIG.retryCount - 1) { await new Promise(r => setTimeout(r, CONFIG.retryBaseDelay * Math.pow(2, attempt))); } }
            }
            throw lastError;
        },
        async fetchAllMessages(chatroomId, cancelToken, onProgress) {
            const collected = []; const seen = new Set();
            let cursor = null; let chunk = 0;
            while (true) {
                if (cancelToken?.cancelled) throw new Error('USER_CANCELLED');
                const url = `/chats/${chatroomId}/messages?limit=${CONFIG.chunkSize}${cursor ? `&cursor=${cursor}` : ''}`;
                const data = await this.request(url);
                const msgs = data.data?.messages || [];
                chunk++;
                if (!msgs.length) break;
                for (const m of msgs) { if (!seen.has(m._id)) { seen.add(m._id); collected.push(m); } }
                if (onProgress) onProgress(collected.length, chunk);
                if (collected.length >= CONFIG.hardLimit) { console.warn(`[HCD] 하드리밋 도달 (${CONFIG.hardLimit}개)`); break; }
                cursor = data.data?.nextCursor;
                if (!cursor) break;
                await new Promise(r => setTimeout(r, 300));
            }
            return collected.reverse();
        },
        async fetchDetail(chatroomId) { return (await this.request(`/chats/${chatroomId}`)).data; },
        async fetchMessagesUntilId(chatroomId, targetId, onProgress) {
            const collected = [];
            const seen = new Set();
            let cursor = null;
            let chunk = 0;

            while (true) {
                const url = `/chats/${chatroomId}/messages?limit=${CONFIG.incrChunkSize}${cursor ? `&cursor=${cursor}` : ''}`;
                const data = await this.request(url);
                const msgs = data.data?.messages || [];
                chunk++;

                if (!msgs.length) break;
                if (chunk > 40) { console.warn('[HCD] 청크 역탐색 안전 제한 도달 (2000개). targetId를 찾지 못해 중단합니다.'); break; }

                let foundTarget = false;
                for (const m of msgs) {
                    if (m._id === targetId) { foundTarget = true; break; }
                    if (!seen.has(m._id)) { seen.add(m._id); collected.push(m); }
                }

                if (onProgress) onProgress(collected.length, chunk);
                if (foundTarget) break;

                cursor = data.data?.nextCursor;
                if (!cursor) break;

                await new Promise(r => setTimeout(r, 300));
            }

            return collected.reverse();
        }
    };

    const Generator = {
        escapeHtml(text) { return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); },
        normalizeHighlightSyntax(text) {
            return String(text || '');
        },
        renderMarkdown(text, renderer) {
            const slots = [];
            const normalized = this.normalizeHighlightSyntax(text);
            const protectedText = normalized.replace(/\[hl:([a-z]+)\]([\s\S]*?)\[\/hl\]/gi, (_, color, body) => {
                const token = `@@HCD_HL_${slots.length}@@`;
                const safeColor = ['yellow', 'pink', 'green', 'blue', 'purple'].includes(String(color || '').toLowerCase()) ? String(color).toLowerCase() : 'yellow';
                slots.push({ token, body, color: safeColor });
                return token;
            });
            let html = marked.parse(protectedText, { renderer, breaks: true });
            for (const slot of slots) {
                const markHtml = `<mark data-hl="1" class="hl-color-${slot.color}">${this.escapeHtml(slot.body).replace(/\n/g, '<br>')}</mark>`;
                html = html.split(`<p>${slot.token}</p>`).join(markHtml).split(slot.token).join(markHtml);
            }
            return html;
        },
        getEmbeddedScript(userNote, title) {
            return `
                var userNote = ${JSON.stringify(userNote || '')};
                var docTitle = ${JSON.stringify(title || 'Chat')};
                var editMode = false; var bookmarks = []; var isDark = false; var viewerMode = 'chat'; var viewerChatWidth = 0; var viewerImageSize = 100;
                try { isDark = localStorage.getItem('hcd_dark') === '1'; viewerMode = localStorage.getItem('hcd_viewer_mode') || (document.body && document.body.dataset ? document.body.dataset.viewerMode : '') || viewerMode; viewerChatWidth = Number(localStorage.getItem('hcd_chat_width') || (document.body && document.body.dataset ? document.body.dataset.viewerChatWidth : '') || 0); viewerImageSize = Number(localStorage.getItem('hcd_image_size') || (document.body && document.body.dataset ? document.body.dataset.viewerImageSize : '') || 100); } catch(e) { if (document.body && document.body.dataset) { if (document.body.dataset.viewerMode) viewerMode = document.body.dataset.viewerMode; if (document.body.dataset.viewerChatWidth) viewerChatWidth = Number(document.body.dataset.viewerChatWidth) || 0; if (document.body.dataset.viewerImageSize) viewerImageSize = Number(document.body.dataset.viewerImageSize) || 100; } }
                var renderer = new marked.Renderer();
                function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function(ch) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch]; }); }
                function getSafeHighlightColor(color) { color = String(color || '').toLowerCase(); return ['yellow','pink','green','blue','purple'].indexOf(color) > -1 ? color : 'yellow'; }
                function normalizeHighlightSyntax(text) { return String(text || ''); }
                function parseContent(text) { var slots = []; var src = normalizeHighlightSyntax(text); var protectedText = src.replace(/\\[hl:([a-z]+)\\]([\\s\\S]*?)\\[\\/hl\\]/gi, function(_, color, body) { var token = '@@HCD_HL_' + slots.length + '@@'; slots.push({ token: token, body: body, color: getSafeHighlightColor(color) }); return token; }); var html = marked.parse(protectedText, { renderer: renderer, breaks: true }); slots.forEach(function(slot) { var markHtml = '<mark data-hl="1" class="hl-color-' + slot.color + '">' + escapeHtml(slot.body).replace(/\\n/g, '<br>') + '</mark>'; html = html.split('<p>' + slot.token + '</p>').join(markHtml).split(slot.token).join(markHtml); }); return html; }
                renderer.code = function(code, language) { var safeCode = escapeHtml(code); var safeLang = escapeHtml(language || ''); if (safeLang) return '<div class="code-header">' + safeLang + '</div><pre class="has-header"><code>' + safeCode + '</code></pre>'; return '<pre><code>' + safeCode + '</code></pre>'; };
                function autoResize(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 5) + 'px'; }
                function getScrollContainer() { return document.querySelector('.content-area'); }
                window.toggleDarkMode = function() { isDark = !isDark; document.body.classList.toggle('dark-mode', isDark); try { localStorage.setItem('hcd_dark', isDark ? '1' : '0'); } catch(e) {} var btn = document.getElementById('darkModeBtn'); if (btn) btn.innerHTML = isDark ? '${ICONS.sun}' : '${ICONS.moon}'; var badge = document.getElementById('darkModeStatus'); if (badge) { badge.textContent = isDark ? 'ON' : 'OFF'; badge.className = 'mode-badge ' + (isDark ? 'on' : 'off'); } };
                if (isDark) document.body.classList.add('dark-mode');
                function applyViewerMode(mode, remember) { mode = mode === 'novel' ? 'novel' : 'chat'; viewerMode = mode; document.body.classList.toggle('novel-mode', mode === 'novel'); if (document.body && document.body.dataset) document.body.dataset.viewerMode = mode; var novelChoice = document.getElementById('novelModeChoice'); var chatChoice = document.getElementById('chatModeChoice'); if (novelChoice) { novelChoice.dataset.selected = mode === 'novel' ? '1' : '0'; novelChoice.setAttribute('aria-pressed', mode === 'novel' ? 'true' : 'false'); } if (chatChoice) { chatChoice.dataset.selected = mode === 'chat' ? '1' : '0'; chatChoice.setAttribute('aria-pressed', mode === 'chat' ? 'true' : 'false'); } try { if (remember) localStorage.setItem('hcd_viewer_mode', mode); } catch(e) {} }
                window.setViewerMode = function(mode) { applyViewerMode(mode, true); };
                function clampChatWidth(val) { var width = Number(val); return Number.isFinite(width) ? Math.min(100, Math.max(-50, Math.round(width))) : 0; }
                function formatChatWidth(val) { var width = clampChatWidth(val); return width === 0 ? '기본' : (width > 0 ? '+' + width + '%' : width + '%'); }
                function getChatWidthCss(val) { var width = clampChatWidth(val); if (width === 0) return '950px'; if (width > 0) return 'calc(950px + (96vw - 950px) * (' + width + ' / 100))'; return 'calc(950px * (1 + (' + width + ' / 100)))'; }
                function updateChatWidthAvailability() { var slider = document.getElementById('chatWidthSlider'); var value = document.getElementById('chatWidthVal'); var supported = window.innerWidth > 768; if (slider) { slider.disabled = !supported; slider.title = supported ? '' : '모바일에서는 화면 폭에 맞춰 고정됩니다'; } if (value) value.textContent = supported ? formatChatWidth(slider ? slider.value : viewerChatWidth) : '모바일 고정'; }
                window.changeChatWidth = function(val) { var width = clampChatWidth(val); viewerChatWidth = width; document.documentElement.style.setProperty('--viewer-chat-width', getChatWidthCss(width)); if (document.body && document.body.dataset) document.body.dataset.viewerChatWidth = String(width); var slider = document.getElementById('chatWidthSlider'); if (slider && slider.value !== String(width)) slider.value = String(width); try { localStorage.setItem('hcd_chat_width', String(width)); } catch(e) {} updateChatWidthAvailability(); };
                window.changeImgSize = function(val) { var size = Math.min(100, Math.max(20, Math.round(Number(val) || 100))); viewerImageSize = size; document.documentElement.style.setProperty('--img-width', size + '%'); if (document.body && document.body.dataset) document.body.dataset.viewerImageSize = String(size); var slider = document.getElementById('imgSizeSlider'); if (slider && slider.value !== String(size)) slider.value = String(size); var value = document.getElementById('imgSizeVal'); if (value) value.textContent = size === 100 ? '기본' : size + '%'; try { localStorage.setItem('hcd_image_size', String(size)); } catch(e) {} };
                window.addEventListener('resize', function() { updateChatWidthAvailability(); }, { passive: true });
                document.addEventListener('DOMContentLoaded', function() { if (isDark) { var btn = document.getElementById('darkModeBtn'); if (btn) btn.innerHTML = '${ICONS.sun}'; var badge = document.getElementById('darkModeStatus'); if (badge) { badge.textContent = 'ON'; badge.className = 'mode-badge on'; } } });
                var _searchTimer = null;
                window.onSearchInput = function(val) { clearTimeout(_searchTimer); _searchTimer = setTimeout(function() { performSearch(val); }, 250); };
                function performSearch(query) { var list = document.getElementById('searchResults'); var countEl = document.getElementById('searchCount'); if (!list) return; document.querySelectorAll('.msg-wrapper').forEach(function(w) { w.classList.remove('search-match'); }); if (!query || query.length < 2) { list.innerHTML = '<div class="rsb-empty">2글자 이상 입력하세요</div>'; if (countEl) countEl.textContent = ''; return; } var wrappers = document.querySelectorAll('.msg-wrapper'); var results = []; var lq = query.toLowerCase(); wrappers.forEach(function(w, idx) { var mc = w.querySelector('.msg-content'); if (!mc) return; var text = mc.textContent || ''; if (text.toLowerCase().indexOf(lq) === -1) return; var role = w.classList.contains('user') ? 'User' : 'AI'; var pos = text.toLowerCase().indexOf(lq); var start = Math.max(0, pos - 20); var end = Math.min(text.length, pos + query.length + 30); var preview = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : ''); results.push({ idx: idx, role: role, preview: preview }); w.classList.add('search-match'); }); if (countEl) countEl.textContent = results.length + '건'; if (!results.length) { list.innerHTML = '<div class="rsb-empty">검색 결과가 없습니다</div>'; return; } list.innerHTML = results.map(function(r) { var safe = r.preview.replace(/</g,'&lt;').replace(/>/g,'&gt;'); var esc = query.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'); safe = safe.replace(new RegExp('(' + esc + ')', 'gi'), '<span class="search-match-text">$1</span>'); return '<div class="search-item" onclick="scrollToSearch(' + r.idx + ')"><span class="bm-role ' + r.role.toLowerCase() + '">' + r.role + '</span><span class="search-preview">' + safe + '</span></div>'; }).join(''); }
                window.clearSearch = function() { var input = document.getElementById('searchInput'); if (input) input.value = ''; performSearch(''); };
                window.scrollToSearch = function(idx) { var w = document.querySelectorAll('.msg-wrapper')[idx]; if (!w) return; w.classList.add('flash'); setTimeout(function(){ w.classList.remove('flash'); }, 1500); var input = document.getElementById('searchInput'); var query = input ? input.value.trim() : ''; var mc = w.querySelector('.msg-content'); if (query && mc) { var walker = document.createTreeWalker(mc, NodeFilter.SHOW_TEXT, null, false); var lq = query.toLowerCase(); var node, found = false; while (node = walker.nextNode()) { var pos = node.textContent.toLowerCase().indexOf(lq); if (pos === -1) continue; var range = document.createRange(); range.setStart(node, pos); range.setEnd(node, pos + query.length); var span = document.createElement('span'); span.className = 'search-flash'; span.style.cssText = 'background:#ff6b6b;color:#fff;padding:0 2px;border-radius:3px;transition:background 0.3s'; try { range.surroundContents(span); } catch(e) { break; } span.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function(s){ s.style.background = '#ffe066'; s.style.color = '#333'; }, 300, span); setTimeout(function(s){ s.style.background = '#ff6b6b'; s.style.color = '#fff'; }, 600, span); setTimeout(function(s){ s.style.background = '#ffe066'; s.style.color = '#333'; }, 900, span); setTimeout(function(s){ var parent = s.parentNode; if (parent) { parent.replaceChild(document.createTextNode(s.textContent), s); parent.normalize(); } }, 1500, span); found = true; break; } if (found) return; } var bubble = w.querySelector('.msg-bubble'); if (bubble) bubble.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
                window.toggleRightSidebar = function() { document.body.classList.toggle('rsb-open'); };
                window.showPanel = function(panelId) { document.querySelectorAll('.rsb-panel').forEach(function(p){ p.classList.remove('active'); }); document.querySelectorAll('.rsb-icon').forEach(function(i){ i.classList.remove('active'); }); var panel = document.getElementById('panel-' + panelId); var icon = document.querySelector('[data-panel="' + panelId + '"]'); if (panel) panel.classList.add('active'); if (icon) icon.classList.add('active'); if (!document.body.classList.contains('rsb-open')) document.body.classList.add('rsb-open'); if (panelId === 'search') { var si = document.getElementById('searchInput'); if (si) setTimeout(function(){ si.focus(); }, 100); } };
                window.toggleEditMode = function() { var sc = getScrollContainer(); var anchor = null, anchorTop = 0; if (sc) { var wrappers = document.querySelectorAll('.msg-wrapper'); var viewMid = sc.getBoundingClientRect().top + sc.clientHeight / 2; var bestDist = Infinity; wrappers.forEach(function(w) { var r = w.getBoundingClientRect(); var d = Math.abs(r.top + r.height / 2 - viewMid); if (d < bestDist) { bestDist = d; anchor = w; } }); if (anchor) anchorTop = anchor.getBoundingClientRect().top; } editMode = !editMode; document.body.classList.toggle('edit-mode-on', editMode); document.getElementById('editModeStatus').textContent = editMode ? 'ON' : 'OFF'; document.getElementById('editModeStatus').className = 'mode-badge ' + (editMode ? 'on' : 'off'); if (sc && anchor) { void sc.offsetHeight; sc.scrollTop += (anchor.getBoundingClientRect().top - anchorTop); } };
                window.enterEditMode = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var contentDiv = wrapper.querySelector('.msg-content'); var bubble = wrapper.querySelector('.msg-bubble'); var rawText = decodeURIComponent(contentDiv.dataset.raw); var sc = getScrollContainer(); var rect = bubble.getBoundingClientRect(); bubble.style.width = rect.width + 'px'; bubble.style.maxWidth = rect.width + 'px'; bubble.style.minWidth = rect.width + 'px'; var bottomBefore = bubble.getBoundingClientRect().bottom; var editor = document.createElement('textarea'); editor.className = 'edit-area'; editor.value = rawText; editor.addEventListener('input', function() { autoResize(this); }); var actions = wrapper.querySelector('.msg-actions'); actions.innerHTML = '<button onclick="saveEdit(this)" class="action-btn save" title="확인">${ICONS.check}</button><button onclick="cancelEdit(this)" class="action-btn cancel" title="취소">${ICONS.close}</button>'; wrapper.classList.add('editing'); contentDiv.style.display = 'none'; bubble.insertBefore(editor, contentDiv); autoResize(editor); editor.focus(); if (sc) { void sc.offsetHeight; sc.scrollTop += (bubble.getBoundingClientRect().bottom - bottomBefore); } };
                window.saveEdit = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var bubble = wrapper.querySelector('.msg-bubble'); var editor = wrapper.querySelector('.edit-area'); var contentDiv = wrapper.querySelector('.msg-content'); var sc = getScrollContainer(); var bottomBefore = bubble.getBoundingClientRect().bottom; var normalized = normalizeHighlightSyntax(editor.value); contentDiv.dataset.raw = encodeURIComponent(normalized); contentDiv.innerHTML = parseContent(normalized); editor.remove(); contentDiv.style.display = 'block'; bubble.style.width = ''; bubble.style.maxWidth = ''; bubble.style.minWidth = ''; wrapper.classList.remove('editing'); restoreButtons(wrapper); renderHighlightList(); if (sc) { void sc.offsetHeight; sc.scrollTop += (bubble.getBoundingClientRect().bottom - bottomBefore); } };
                window.cancelEdit = function(btn) { var wrapper = btn.closest('.msg-wrapper'); var bubble = wrapper.querySelector('.msg-bubble'); var sc = getScrollContainer(); var bottomBefore = bubble.getBoundingClientRect().bottom; wrapper.querySelector('.edit-area').remove(); wrapper.querySelector('.msg-content').style.display = 'block'; bubble.style.width = ''; bubble.style.maxWidth = ''; bubble.style.minWidth = ''; wrapper.classList.remove('editing'); restoreButtons(wrapper); if (sc) { void sc.offsetHeight; sc.scrollTop += (bubble.getBoundingClientRect().bottom - bottomBefore); } };
                window.deleteMsg = function(btn) { if(!confirm('이 메시지를 삭제하시겠습니까?')) return; var wrapper = btn.closest('.msg-wrapper'); var idx = Array.from(document.querySelectorAll('.msg-wrapper')).indexOf(wrapper); var bmIdx = bookmarks.findIndex(function(b){return b.idx===idx;}); if(bmIdx > -1) bookmarks.splice(bmIdx, 1); bookmarks.forEach(function(b){ if(b.idx > idx) b.idx--; }); wrapper.remove(); renderBookmarkList(); renderHighlightList(); };
                function restoreButtons(wrapper) { wrapper.querySelector('.msg-actions').innerHTML = '<button onclick="enterEditMode(this)" class="action-btn" title="수정">${ICONS.edit}</button><button onclick="deleteMsg(this)" class="action-btn delete" title="삭제">${ICONS.trash}</button>'; }
                var currentSelectionRange = null, currentSelectionNode = null, currentSelectionText = '', selectionToolbarFrame = 0, messageGesture = null, lastTouchGestureStart = 0, viewerIsScrolling = false, viewerScrollIdleTimer = 0;
                var LONG_PRESS_MS = 800, LONG_PRESS_MOVE_LIMIT = 12, MOBILE_SWIPE_TRIGGER = 56, MOBILE_SWIPE_VERTICAL_LIMIT = 30, MOBILE_SWIPE_RATIO = 1.35;
                function clearMessageGesture() { if (messageGesture && messageGesture.timer) clearTimeout(messageGesture.timer); if (messageGesture && messageGesture.wrapper) messageGesture.wrapper.classList.remove('longpress-pending','bookmark-swipe-left','bookmark-swipe-right'); messageGesture = null; }
                function isTouchBookmarkSurface(pointerType) { return pointerType === 'touch' || pointerType === 'pen' || window.innerWidth <= 1024 || matchMedia('(pointer: coarse)').matches; }
                function isMessageGestureBlockedTarget(target) { return !!(target && target.closest && target.closest('img,picture,video,a,button,textarea,input,select,label,summary,[contenteditable="true"],.edit-area,.msg-actions,.action-btn,#hl-toolbar,.right-sidebar')); }
                function getGestureWrapper(target, area) { if (!target || isMessageGestureBlockedTarget(target)) return null; var hit = target.closest && target.closest('.msg-wrapper,.msg-bubble'); var wrapper = hit && hit.classList.contains('msg-wrapper') ? hit : (hit && hit.closest('.msg-wrapper')); return wrapper && area.contains(wrapper) ? wrapper : null; }
                function isSwipeConfirmed(gesture, clientX, clientY) { var dx = clientX - gesture.startX, dy = clientY - gesture.startY; return Math.abs(dx) >= MOBILE_SWIPE_TRIGGER && Math.abs(dx) > Math.abs(dy) * MOBILE_SWIPE_RATIO; }
                function updateSwipeGesture(gesture, clientX, clientY, event) { var dx = clientX - gesture.startX, dy = clientY - gesture.startY, absX = Math.abs(dx), absY = Math.abs(dy); if (absY >= MOBILE_SWIPE_VERTICAL_LIMIT && absY > absX * 0.9) { clearMessageGesture(); return; } var ok = isSwipeConfirmed(gesture, clientX, clientY); gesture.swipeReady = ok; gesture.wrapper.classList.toggle('bookmark-swipe-left', ok && dx < 0); gesture.wrapper.classList.toggle('bookmark-swipe-right', ok && dx > 0); if (ok && event && event.cancelable) event.preventDefault(); }
                function finishSwipeGesture(gesture, clientX, clientY, event) { var shouldOpen = gesture.swipeReady && isSwipeConfirmed(gesture, clientX, clientY) && !(window.getSelection() && !window.getSelection().isCollapsed); var wrapper = gesture.wrapper; clearMessageGesture(); if (!shouldOpen) return; if (event && event.cancelable) event.preventDefault(); openBookmarkDialog(wrapper); }
                function startMessageGesture(target, clientX, clientY, pointerId, pointerType, source) { var area = document.querySelector('.container'); if (!area) return; var wrapper = getGestureWrapper(target, area); if (!wrapper || viewerIsScrolling) return; clearMessageGesture(); var useSwipe = source === 'touch' || isTouchBookmarkSurface(pointerType); var gesture = { pointerId: pointerId, source: source, mode: useSwipe ? 'swipe' : 'longpress', startX: clientX, startY: clientY, wrapper: wrapper, swipeReady: false, triggered: false, timer: 0 }; messageGesture = gesture; if (useSwipe) return; wrapper.classList.add('longpress-pending'); gesture.timer = setTimeout(function() { if (messageGesture !== gesture) return; var sel = window.getSelection(); if (sel && !sel.isCollapsed) { clearMessageGesture(); return; } gesture.triggered = true; gesture.timer = 0; gesture.wrapper.classList.remove('longpress-pending'); openBookmarkDialog(gesture.wrapper); }, LONG_PRESS_MS); }
                function setupDelegatedMessageGestures() { var area = document.querySelector('.container'); if (!area || area.dataset.messageGesturesReady === '1') return; area.dataset.messageGesturesReady = '1'; area.addEventListener('pointerdown', function(e) { if (e.pointerType === 'mouse' && e.button !== 0) return; if (e.pointerType !== 'mouse' && Date.now() - lastTouchGestureStart < 700) return; startMessageGesture(e.target, e.clientX, e.clientY, e.pointerId, e.pointerType || 'mouse', 'pointer'); }); area.addEventListener('pointermove', function(e) { var g = messageGesture; if (!g || g.source !== 'pointer' || g.pointerId !== e.pointerId || g.triggered) return; var dx = e.clientX - g.startX, dy = e.clientY - g.startY; if (g.mode === 'longpress') { if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_LIMIT) clearMessageGesture(); return; } updateSwipeGesture(g, e.clientX, e.clientY, e); }); area.addEventListener('pointerup', function(e) { var g = messageGesture; if (!g || g.source !== 'pointer' || g.pointerId !== e.pointerId) return; var triggered = g.triggered; if (g.mode === 'swipe') { finishSwipeGesture(g, e.clientX, e.clientY, e); return; } clearMessageGesture(); if (triggered && e.cancelable) e.preventDefault(); }); area.addEventListener('touchstart', function(e) { if (!e.touches || e.touches.length !== 1) return; lastTouchGestureStart = Date.now(); var t = e.touches[0]; startMessageGesture(e.target, t.clientX, t.clientY, null, 'touch', 'touch'); }, { passive: true }); area.addEventListener('touchmove', function(e) { var g = messageGesture; if (!g || g.source !== 'touch' || !e.touches || e.touches.length !== 1) return; var t = e.touches[0]; updateSwipeGesture(g, t.clientX, t.clientY, e); }, { passive: false }); area.addEventListener('touchend', function(e) { var g = messageGesture; if (!g || g.source !== 'touch') return; var t = e.changedTouches && e.changedTouches[0]; if (!t) { clearMessageGesture(); return; } finishSwipeGesture(g, t.clientX, t.clientY, e); }, { passive: false }); var sc = getScrollContainer(); if (sc) sc.addEventListener('scroll', function() { viewerIsScrolling = true; clearMessageGesture(); var tb = document.getElementById('hl-toolbar'); if (tb) tb.classList.remove('show'); if (selectionToolbarFrame) { cancelAnimationFrame(selectionToolbarFrame); selectionToolbarFrame = 0; } clearTimeout(viewerScrollIdleTimer); viewerScrollIdleTimer = setTimeout(function(){ viewerIsScrolling = false; }, 140); }, { passive: true }); }
                function getSelectionMessageContent(node) { var el = node && node.nodeType === 3 ? node.parentElement : node; return el && el.closest ? el.closest('.msg-content') : null; }
                function resetHighlightSelection(toolbar) { if (toolbar) toolbar.classList.remove('show'); currentSelectionRange = null; currentSelectionNode = null; currentSelectionText = ''; }
                function isHighlightExcludedElement(el) { return !!(el && el.closest && el.closest('textarea,input,select,[contenteditable="true"],.edit-area,.search-bar,.right-sidebar,#hl-toolbar')); }
                function scheduleHighlightToolbarCheck(delay) { var run = function() { if (selectionToolbarFrame) return; selectionToolbarFrame = requestAnimationFrame(updateHighlightToolbarFromSelection); }; if (delay) setTimeout(run, delay); else run(); }
                function updateHighlightToolbarFromSelection() { selectionToolbarFrame = 0; var sel = window.getSelection(); var toolbar = document.getElementById('hl-toolbar'); if (viewerIsScrolling || !toolbar || !sel.rangeCount || sel.isCollapsed) { resetHighlightSelection(toolbar); return; } var range = sel.getRangeAt(0); var contentDiv = getSelectionMessageContent(range.startContainer); var endContentDiv = getSelectionMessageContent(range.endContainer); var selectedText = sel.toString().trim(); if (!selectedText || !contentDiv || contentDiv !== endContentDiv || isHighlightExcludedElement(contentDiv)) { resetHighlightSelection(toolbar); return; } clearMessageGesture(); currentSelectionRange = range.cloneRange(); currentSelectionNode = contentDiv; currentSelectionText = selectedText; var rect = range.getBoundingClientRect(); var st = window.scrollY || 0, sl = window.scrollX || 0, tw = toolbar.offsetWidth || 230; var top = rect.top + st - 46; if (top < st + 8) top = rect.bottom + st + 10; var idealLeft = rect.left + sl + rect.width / 2 - tw / 2; var left = Math.max(sl + 8, Math.min(idealLeft, sl + window.innerWidth - tw - 8)); toolbar.style.top = top + 'px'; toolbar.style.left = left + 'px'; toolbar.classList.add('show'); }
                document.addEventListener('selectionchange', function() { var sel = window.getSelection(); if (sel && !sel.isCollapsed) clearMessageGesture(); scheduleHighlightToolbarCheck(); });
                document.addEventListener('pointerup', function(e) { if (e.target && e.target.closest && e.target.closest('#hl-toolbar')) return; scheduleHighlightToolbarCheck(); });
                document.addEventListener('mouseup', function(e) { if (e.target && e.target.closest && e.target.closest('#hl-toolbar')) return; scheduleHighlightToolbarCheck(); });
                document.addEventListener('touchend', function(e) { if (e.target && e.target.closest && e.target.closest('#hl-toolbar')) return; scheduleHighlightToolbarCheck(100); }, { passive: true });
                function applyHighlight(color) { var safeColor = getSafeHighlightColor(color); var sel = window.getSelection(); var selectedText = (currentSelectionText || (sel ? sel.toString() : '')).trim(); if (!selectedText || !currentSelectionNode || !currentSelectionRange) return; var contentDiv = currentSelectionNode; var occurrenceIndex = 0; try { var preRange = document.createRange(); preRange.setStart(contentDiv, 0); preRange.setEnd(currentSelectionRange.startContainer, currentSelectionRange.startOffset); var prefixLen = preRange.toString().length; var fullText = contentDiv.textContent; var sPos = 0; while (true) { var found = fullText.indexOf(selectedText, sPos); if (found === -1 || found >= prefixLen) break; occurrenceIndex++; sPos = found + 1; } } catch(e) {} var rawStr = normalizeHighlightSyntax(decodeURIComponent(contentDiv.dataset.raw)); var matchCount = 0, targetMatch = null, match; var plainIdx = rawStr.indexOf(selectedText); if (plainIdx > -1 && occurrenceIndex === 0) targetMatch = { index: plainIdx, 0: selectedText }; if (!targetMatch) { var chars = selectedText.replace(/\\s+/g, '').split(''); if (!chars.length) return; var allowed = '[\\\\s\\\\*\\\\_\\\\~\\\\x60\\\\[\\\\]\\\\(\\\\)\\\\#\\\\>\\\\+\\\\-\\\\|]*'; var regexStr = chars.map(function(c){ return c.replace(/[.*+?^(){}|\\[\\]\\\\$]/g, '\\\\$&'); }).join(allowed); var regex = new RegExp(regexStr, 'g'); while ((match = regex.exec(rawStr)) !== null) { if (matchCount === occurrenceIndex) { targetMatch = match; break; } matchCount++; } if (!targetMatch) { regex.lastIndex = 0; targetMatch = regex.exec(rawStr); } } if (!targetMatch) return; var targetIdx = targetMatch.index, endIdx = targetIdx + targetMatch[0].length; var mdChars = ['*','_','~',String.fromCharCode(96),'[',']']; while (targetIdx > 0 && mdChars.indexOf(rawStr[targetIdx - 1]) > -1) targetIdx--; while (endIdx < rawStr.length && mdChars.indexOf(rawStr[endIdx]) > -1) endIdx++; var expanded = rawStr.substring(targetIdx, endIdx); var clean = expanded.replace(/\\[hl:[a-z]+\\]/gi, '').replace(/\\[\\/hl\\]/gi, ''); var newRaw = rawStr.substring(0, targetIdx) + '[hl:' + safeColor + ']' + clean + '[/hl]' + rawStr.substring(endIdx); contentDiv.dataset.raw = encodeURIComponent(newRaw); contentDiv.innerHTML = parseContent(newRaw); renderHighlightList(); var tb = document.getElementById('hl-toolbar'); if (tb) tb.classList.remove('show'); if (sel) sel.removeAllRanges(); resetHighlightSelection(tb); }
                function removeHighlightFromSelection() { if (!currentSelectionNode) return; var sel = window.getSelection(); var anchor = sel && sel.anchorNode; var el = anchor && anchor.nodeType === 3 ? anchor.parentElement : anchor; var mark = el && el.closest ? el.closest('mark') : null; if (mark && currentSelectionNode.contains(mark)) { var wrapperIdx = Array.from(document.querySelectorAll('.msg-wrapper')).indexOf(currentSelectionNode.closest('.msg-wrapper')); var markIdx = Array.from(currentSelectionNode.querySelectorAll('mark')).indexOf(mark); removeHighlight(wrapperIdx, markIdx); } var tb = document.getElementById('hl-toolbar'); if (tb) tb.classList.remove('show'); if (sel) sel.removeAllRanges(); resetHighlightSelection(tb); }
                function setupHighlightToolbar() { var toolbar = document.getElementById('hl-toolbar'); if (!toolbar) return; toolbar.addEventListener('pointerdown', function(e) { e.preventDefault(); }); toolbar.querySelectorAll('.hl-btn[data-color]').forEach(function(btn) { btn.onclick = function(e) { e.preventDefault(); applyHighlight(btn.getAttribute('data-color')); }; }); var removeBtn = toolbar.querySelector('.hl-remove'); if (removeBtn) removeBtn.onclick = function(e) { e.preventDefault(); removeHighlightFromSelection(); }; }
                window.clearAllHighlights = function() { if(!confirm('모든 형광펜을 제거하시겠습니까?')) return; document.querySelectorAll('.msg-content').forEach(function(mc) { mc.querySelectorAll('mark').forEach(function(m) { m.parentNode.replaceChild(document.createTextNode(m.textContent), m); }); mc.normalize(); mc.dataset.raw = encodeURIComponent(normalizeHighlightSyntax(decodeURIComponent(mc.dataset.raw)).replace(/\\[hl:[a-z]+\\]([\\s\\S]*?)\\[\\/hl\\]/gi, '$1')); }); renderHighlightList(); };
                function getHighlightColorClass(mark) { var colorClass = 'hl-color-yellow'; if (mark && mark.classList) { Array.prototype.some.call(mark.classList, function(cls) { if (/^hl-color-(yellow|pink|green|blue|purple)$/.test(cls)) { colorClass = cls; return true; } return false; }); } return colorClass; }
                function renderHighlightList() { var list = document.getElementById('highlightList'); if (!list) return; var items = []; document.querySelectorAll('.msg-wrapper').forEach(function(w, idx) { var marks = w.querySelectorAll('.msg-content mark'); if (!marks.length) return; var role = w.classList.contains('user') ? 'User' : 'AI'; marks.forEach(function(m, mi) { items.push({ idx: idx, markIdx: mi, role: role, text: m.textContent.substring(0, 50), colorClass: getHighlightColorClass(m) }); }); }); if (!items.length) { list.innerHTML = '<div class="rsb-empty">형광펜이 없습니다</div>'; return; } list.innerHTML = items.map(function(item) { var safeText = item.text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); return '<div class="hl-item" onclick="scrollToMark(' + item.idx + ',' + item.markIdx + ')"><span class="bm-role ' + item.role.toLowerCase() + '">' + item.role + '</span><span class="hl-text" title="' + safeText + '"><mark class="' + item.colorClass + '">' + safeText + '</mark></span><button class="bm-remove" onclick="event.stopPropagation();removeHighlight(' + item.idx + ',' + item.markIdx + ')" title="제거">✕</button></div>'; }).join(''); }
                window.scrollToMark = function(wrapperIdx, markIdx) { var wrapper = document.querySelectorAll('.msg-wrapper')[wrapperIdx]; if (!wrapper) return; var target = wrapper.querySelectorAll('.msg-content mark')[markIdx]; if (!target) { scrollToMsg(wrapperIdx); return; } target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.style.transition = 'background 0.3s'; target.style.background = '#ff6b6b'; setTimeout(function() { target.style.background = '#ffe066'; }, 300); setTimeout(function() { target.style.background = '#ff6b6b'; }, 600); setTimeout(function() { target.style.background = ''; target.style.transition = ''; }, 900); };
                window.removeHighlight = function(wrapperIdx, markIdx) { var wrapper = document.querySelectorAll('.msg-wrapper')[wrapperIdx]; if (!wrapper) return; var msgContent = wrapper.querySelector('.msg-content'); var target = msgContent.querySelectorAll('mark')[markIdx]; if (!target) return; target.parentNode.replaceChild(document.createTextNode(target.textContent), target); msgContent.normalize(); var raw = normalizeHighlightSyntax(decodeURIComponent(msgContent.dataset.raw)); var regex = /\\[hl:[a-z]+\\]([\\s\\S]*?)\\[\\/hl\\]/gi; var match, count = 0, newRaw = raw; while ((match = regex.exec(raw)) !== null) { if (count === markIdx) { newRaw = raw.substring(0, match.index) + match[1] + raw.substring(match.index + match[0].length); break; } count++; } msgContent.dataset.raw = encodeURIComponent(newRaw); renderHighlightList(); };
                function openBookmarkDialog(wrapper) { if (!wrapper) return; var idx = Array.from(document.querySelectorAll('.msg-wrapper')).indexOf(wrapper); if (idx < 0) return; var bmIdx = bookmarks.findIndex(function(b){return b.idx===idx;}); if (bmIdx > -1) { var choice = prompt('이미 북마크된 메시지입니다.\\n1 = 이름 변경\\n2 = 북마크 해제\\n취소 = 닫기', '1'); if (choice === '1') renameBm(idx); else if (choice === '2' && confirm('이 북마크를 해제하시겠습니까?')) removeBm(idx); return; } var preview = (wrapper.querySelector('.msg-content')?.textContent || '').substring(0, 40).trim() || '북마크'; var name = prompt('북마크 이름을 입력하세요:', preview); if (name === null) return; var bmName = name || preview; bookmarks.push({ idx: idx, name: bmName }); wrapper.classList.add('bookmarked'); wrapper.dataset.bmName = bmName; renderBookmarkList(); }
                function loadBookmarksFromDom() { bookmarks = []; document.querySelectorAll('.msg-wrapper').forEach(function(w, idx) { if (!w.classList.contains('bookmarked')) return; var preview = (w.querySelector('.msg-content')?.textContent || '').substring(0, 40).trim() || '북마크'; bookmarks.push({ idx: idx, name: w.dataset.bmName || preview }); }); }
                function renderBookmarkList() { var list = document.getElementById('bookmarkList'); if (!list) return; if (!bookmarks.length) { list.innerHTML = '<div class="rsb-empty">북마크가 없습니다</div>'; return; } var sorted = bookmarks.slice().sort(function(a,b){return a.idx-b.idx;}); var wrappers = document.querySelectorAll('.msg-wrapper'); list.innerHTML = sorted.map(function(bm) { var w = wrappers[bm.idx]; if(!w) return ''; var role = w.classList.contains('user') ? 'User' : 'AI'; var safeName = bm.name.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); return '<div class="bm-item" onclick="scrollToMsg(' + bm.idx + ')"><span class="bm-role ' + role.toLowerCase() + '">' + role + '</span><span class="bm-text" title="' + safeName + '">' + safeName + '</span><button class="bm-edit" onclick="event.stopPropagation();renameBm(' + bm.idx + ')" title="이름 변경">${ICONS.pencil}</button><button class="bm-remove" onclick="event.stopPropagation();removeBm(' + bm.idx + ')" title="삭제">✕</button></div>'; }).join(''); }
                window.scrollToMsg = function(idx) { var w = document.querySelectorAll('.msg-wrapper')[idx]; if (!w) return; var bubble = w.querySelector('.msg-bubble'); if (bubble) bubble.scrollIntoView({ behavior: 'smooth', block: 'start' }); w.classList.add('flash'); setTimeout(function(){ w.classList.remove('flash'); }, 1500); };
                window.renameBm = function(idx) { var bm = bookmarks.find(function(b){return b.idx===idx;}); if(!bm) return; var n = prompt('북마크 이름 변경:', bm.name); if(n === null) return; bm.name = n || bm.name; var w = document.querySelectorAll('.msg-wrapper')[idx]; if (w) w.dataset.bmName = bm.name; renderBookmarkList(); };
                window.removeBm = function(idx) { var i = bookmarks.findIndex(function(b){return b.idx===idx;}); if(i > -1) bookmarks.splice(i, 1); var w = document.querySelectorAll('.msg-wrapper')[idx]; if (w) { w.classList.remove('bookmarked'); delete w.dataset.bmName; } renderBookmarkList(); };
                loadBookmarksFromDom(); applyViewerMode(viewerMode, false); changeChatWidth(viewerChatWidth); changeImgSize(viewerImageSize); setupDelegatedMessageGestures(); setupHighlightToolbar(); renderHighlightList(); renderBookmarkList();
                window.downloadModifiedHtml = function() { if(document.querySelector('.edit-area')) { alert('편집 중인 메시지가 있습니다. 먼저 확인 또는 취소를 눌러주세요.'); return; } var clone = document.documentElement.cloneNode(true); clone.querySelector('body')?.classList.remove('rsb-open','edit-mode-on'); clone.querySelectorAll('.search-match,.longpress-pending,.bookmark-swipe-left,.bookmark-swipe-right').forEach(function(el) { el.classList.remove('search-match','longpress-pending','bookmark-swipe-left','bookmark-swipe-right'); }); var tb = clone.querySelector('#hl-toolbar'); if (tb) tb.classList.remove('show'); var si = clone.querySelector('#searchInput'); if (si) si.value = ''; var sr = clone.querySelector('#searchResults'); if (sr) sr.innerHTML = '<div class="rsb-empty">2글자 이상 입력하세요</div>'; var sc = clone.querySelector('#searchCount'); if (sc) sc.textContent = ''; var htmlStr = '<!DOCTYPE html>' + clone.outerHTML; var blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = docTitle + '_edited.html'; document.body.appendChild(a); a.click(); setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300); };
            `;
        },
        buildHtml(title, messages, userNote) {
            const renderer = new marked.Renderer();
            renderer.code = (code, language) => { const safeCode = this.escapeHtml(code); const safeLang = this.escapeHtml(language || ''); if (safeLang) return `<div class="code-header">${safeLang}</div><pre class="has-header"><code>${safeCode}</code></pre>`; return `<pre><code>${safeCode}</code></pre>`; };
            const contentHtml = messages.map((msg, i) => { const normalized = this.normalizeHighlightSyntax(msg.content); const rawContent = encodeURIComponent(normalized); const roleClass = msg.role === 'user' ? 'user' : 'assistant'; const rendered = this.renderMarkdown(normalized, renderer); return `<div class="msg-wrapper ${roleClass}" data-idx="${i}"><div class="msg-bubble"><div class="msg-content" data-raw="${rawContent}">${rendered}</div><div class="msg-actions"><button onclick="enterEditMode(this)" class="action-btn" title="수정">${ICONS.edit}</button><button onclick="deleteMsg(this)" class="action-btn delete" title="삭제">${ICONS.trash}</button></div></div></div>`; }).join('');
            const escapedNote = this.escapeHtml(userNote).replace(/\n/g, '<br>');
            return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"><title>${this.escapeHtml(title)}</title><script src="https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"><\/script><style>:root { --viewer-chat-width: 950px; --img-width: 100%; --bg: #f8f9fa; --user-bg: #495057; --user-text: white; --ai-bg: #e7f5ff; --text: #333; --header-bg: white; --header-border: #eee; --sidebar-bg: white; --sidebar-icon-bg: #f8f9fa; --sidebar-border: #eee; --panel-header-bg: #fff; --input-bg: #fff; --input-border: #dee2e6; --input-text: #333; --item-hover: #f8f9fa; --item-border: #f1f3f5; --muted: #868e96; --shadow: rgba(0,0,0,0.1); } body.dark-mode { --bg: #1a1b1e; --user-bg: #4dabf7; --user-text: #1a1b1e; --ai-bg: #25262b; --text: #c1c2c5; --header-bg: #25262b; --header-border: #373a40; --sidebar-bg: #25262b; --sidebar-icon-bg: #1a1b1e; --sidebar-border: #373a40; --panel-header-bg: #2c2e33; --input-bg: #2c2e33; --input-border: #495057; --input-text: #c1c2c5; --item-hover: #2c2e33; --item-border: #373a40; --muted: #909296; --shadow: rgba(0,0,0,0.3); } * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; } body { font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif; background: var(--bg); display: flex; flex-direction: column; transition: background 0.3s, color 0.3s; } .header { background: var(--header-bg); padding: 12px 20px; padding-top: max(12px, env(safe-area-inset-top)); border-bottom: 1px solid var(--header-border); display: flex; justify-content: space-between; align-items: center; z-index: 100; box-shadow: 0 2px 5px var(--shadow); flex-shrink: 0; } .header h1 { margin: 0; font-size: 18px; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .header-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; } .rsb-toggle-btn, .dark-toggle-btn { background: none; border: 1px solid var(--input-border); border-radius: 8px; padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); transition: 0.2s; min-width: 44px; min-height: 44px; justify-content: center; } .rsb-toggle-btn:hover, .dark-toggle-btn:hover { background: var(--item-hover); } .main-wrap { display: flex; flex: 1; min-height: 0; } .content-area { flex: 1; overflow-y: auto; min-width: 0; -webkit-overflow-scrolling: touch; } .container { max-width: var(--viewer-chat-width, 950px); margin: 0 auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; padding-bottom: max(50px, env(safe-area-inset-bottom)); } .right-sidebar { width: 0; overflow: hidden; border-left: none; background: var(--sidebar-bg); transition: width 0.3s, border 0.3s; display: flex; flex-shrink: 0; height: 100%; } body.rsb-open .right-sidebar { width: 320px; border-left: 1px solid var(--sidebar-border); } .rsb-icons { width: 48px; background: var(--sidebar-icon-bg); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; align-items: center; padding: 10px 0; gap: 4px; flex-shrink: 0; height: 100%; overflow: hidden; } .rsb-icon { width: 38px; height: 38px; border: none; background: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: 0.2s; position: relative; flex-shrink: 0; min-width: 38px; min-height: 38px; } .rsb-icon:hover { background: var(--item-hover); color: var(--text); } .rsb-icon.active { background: #d0ebff; color: #1971c2; } body.dark-mode .rsb-icon.active { background: #1c3a5c; color: #74c0fc; } .rsb-icon .icon-tooltip { position: absolute; right: 110%; top: 50%; transform: translateY(-50%); background: #333; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: 0.15s; } .rsb-icon:hover .icon-tooltip { opacity: 1; } .rsb-divider { width: 28px; height: 1px; background: var(--sidebar-border); margin: 4px 0; flex-shrink: 0; } .rsb-content { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%; overflow: hidden; } .rsb-panel { display: none; flex-direction: column; height: 100%; overflow: hidden; } .rsb-panel.active { display: flex; } .rsb-panel-header { padding: 14px 16px; font-weight: 700; font-size: 15px; border-bottom: 1px solid var(--sidebar-border); color: var(--text); background: var(--panel-header-bg); flex-shrink: 0; } .rsb-panel-body { padding: 12px 16px; flex: 1; overflow-y: auto; font-size: 14px; line-height: 1.7; color: var(--text); min-height: 0; -webkit-overflow-scrolling: touch; } .rsb-empty { color: var(--muted); text-align: center; padding: 30px 10px; font-size: 13px; } .bm-item, .hl-item, .search-item { padding: 10px 12px; border-bottom: 1px solid var(--item-border); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.15s; min-height: 44px; } .bm-item:hover, .hl-item:hover, .search-item:hover { background: var(--item-hover); } .bm-role { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; } .bm-role.user { background: #495057; color: white; } .bm-role.ai { background: #d0ebff; color: #1971c2; } body.dark-mode .bm-role.user { background: #4dabf7; color: #1a1b1e; } body.dark-mode .bm-role.ai { background: #1c3a5c; color: #74c0fc; } .bm-text, .hl-text { flex: 1; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .hl-text mark { background: #ffe066; color: #333; padding: 0 2px; border-radius: 2px; font-size: 12px; } .bm-edit { background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px; flex-shrink: 0; display: flex; align-items: center; min-width: 30px; min-height: 30px; justify-content: center; } .bm-edit:hover { color: #339af0; } .bm-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 14px; padding: 4px; flex-shrink: 0; min-width: 30px; min-height: 30px; display: flex; align-items: center; justify-content: center; } .bm-remove:hover { color: #fa5252; } .search-bar { display: flex; gap: 6px; padding: 12px 16px; border-bottom: 1px solid var(--sidebar-border); flex-shrink: 0; align-items: center; } .search-input { flex: 1; padding: 10px; border: 1px solid var(--input-border); border-radius: 6px; font-size: 16px; background: var(--input-bg); color: var(--input-text); outline: none; -webkit-appearance: none; min-width: 0; } .search-input:focus { border-color: #339af0; } .search-input::placeholder { color: var(--muted); } .search-clear { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 4px; flex-shrink: 0; min-width: 30px; min-height: 30px; display: flex; align-items: center; justify-content: center; } .search-clear:hover { color: #fa5252; } .search-count { font-size: 11px; color: var(--muted); flex-shrink: 0; min-width: 30px; text-align: right; } .search-preview { flex: 1; font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.4; } .search-match-text { background: #ffe066; color: #333; padding: 0 1px; border-radius: 2px; } .edit-panel-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--item-border); } .edit-panel-row:last-child { border-bottom: none; } .edit-panel-label { font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 6px; } .viewer-mode-box { padding: 0 0 12px; margin-bottom: 6px; border-bottom: 1px solid var(--item-border); } .viewer-mode-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 8px; } .viewer-mode-buttons { display: grid; grid-template-columns: 1fr; gap: 8px; } .viewer-mode-btn { width: 100%; min-height: 42px; padding: 9px 12px; border: 1px solid var(--input-border); border-radius: 10px; background: var(--input-bg); color: var(--text); cursor: pointer; font-size: 14px; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 8px; } .viewer-mode-btn span { width: 22px; height: 22px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: transparent; background: var(--item-border); flex-shrink: 0; } .viewer-mode-btn[data-selected="1"] { border-color: #339af0; background: #e7f5ff; color: #1971c2; } .viewer-mode-btn[data-selected="1"] span { background: #339af0; color: #fff; } body.dark-mode .viewer-mode-btn[data-selected="1"] { background: #1c3a5c; color: #74c0fc; } .viewer-slider-row { padding: 12px 0; border-bottom: 1px solid var(--item-border); } .viewer-slider-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; font-size:14px; font-weight:700; color:var(--text); } .viewer-slider-value { color:var(--muted); font-size:13px; font-weight:800; flex-shrink:0; } .viewer-slider { width:100%; accent-color:#339af0; } .viewer-slider:disabled { opacity:.45; } .mode-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 700; } .mode-badge.on { background: #d3f9d8; color: #2b8a3e; } .mode-badge.off { background: var(--item-border); color: var(--muted); } .edit-panel-btn { padding: 8px 14px; border: 1px solid var(--input-border); border-radius: 6px; background: var(--input-bg); color: var(--text); cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; min-height: 36px; } .edit-panel-btn:hover { background: var(--item-hover); } .edit-panel-btn.danger { color: #fa5252; border-color: #ffc9c9; } .edit-panel-btn.danger:hover { background: #fff5f5; } body.dark-mode .edit-panel-btn.danger:hover { background: #3b1515; } .edit-panel-btn.primary { background: #339af0; color: white; border-color: #339af0; } .edit-panel-btn.primary:hover { background: #228be6; } .msg-wrapper { display: flex; width: 100%; position: relative; margin-bottom: 12px; touch-action: pan-y; } .msg-wrapper.user { justify-content: flex-end; } .msg-wrapper.assistant { justify-content: flex-start; } .msg-wrapper.bookmarked::before { content: ''; position: absolute; left: -8px; top: 0; bottom: 0; width: 4px; background: #ffd43b; border-radius: 2px; } .msg-wrapper.flash { animation: flashAnim 1.5s ease; } @keyframes flashAnim { 0%,100% { background: transparent; } 30% { background: rgba(255,212,59,0.25); } } body.edit-mode-on .msg-wrapper { margin-bottom: 42px; } .msg-bubble { max-width: 95%; padding: 14px 20px; border-radius: 18px; position: relative; font-size: 15.5px; line-height: 1.7; box-shadow: 0 1px 2px var(--shadow); overflow: visible; transition: transform 0.12s ease-out; } .user .msg-bubble { background: var(--user-bg); color: var(--user-text); border-bottom-right-radius: 4px; } .assistant .msg-bubble { background: var(--ai-bg); color: var(--text); border: 1px solid var(--sidebar-border); border-bottom-left-radius: 4px; } body.novel-mode .container { max-width: var(--viewer-chat-width, 900px); gap: 0; } body.novel-mode .msg-wrapper { justify-content: flex-start !important; margin-bottom: 0; } body.novel-mode.edit-mode-on .msg-wrapper { margin-bottom: 42px; } body.novel-mode .msg-bubble { background: transparent !important; border: none !important; box-shadow: none !important; padding: 8px 0 !important; max-width: 100% !important; width: 100% !important; border-radius: 0 !important; color: var(--text) !important; } body.novel-mode .user .msg-bubble { color: var(--text) !important; } body.novel-mode .msg-content { width: 100%; color: var(--text) !important; } body.novel-mode .msg-content :not(pre):not(code):not(mark) { color: var(--text) !important; } body.novel-mode .msg-content em { color: var(--muted) !important; } body.novel-mode .msg-content pre, body.novel-mode .msg-content pre code { color: #d4d4d4 !important; } .msg-content p { margin: 0 0 16px 0; } .msg-content p:last-child { margin-bottom: 0; } em { font-style: normal; color: var(--muted); } .user em { color: rgba(255,255,255,0.7); } body.dark-mode .user em { color: rgba(26,27,30,0.6); } mark { background-color: #ffe066; color: #333; padding: 0 2px; border-radius: 2px; } img { max-width: var(--img-width, 100%); width: auto; border-radius: 8px; } pre { background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin: 10px 0; } pre.has-header { border-top-left-radius: 0; border-top-right-radius: 0; margin-top: 0; } .code-header { background-color: #2d2d2d; color: #ccc; padding: 6px 12px; font-size: 12px; border-top-left-radius: 8px; border-top-right-radius: 8px; font-family: monospace; font-weight: bold; margin-top: 10px; } code { font-family: monospace; white-space: pre-wrap; word-break: break-word; } .edit-area { width: 100%; box-sizing: border-box; min-height: 50px; padding: 10px; border-radius: 8px; border: 2px solid #339af0; background-color: var(--input-bg); color: var(--input-text); resize: vertical; font-family: inherit; font-size: 16px; line-height: 1.6; outline: none; margin-bottom: 5px; -webkit-appearance: none; } .msg-actions { position: absolute; bottom: -30px; left: 0; display: none; gap: 5px; z-index: 5; } .user .msg-actions { left: auto; right: 0; } body.edit-mode-on .msg-wrapper .msg-actions { display: flex; } .action-btn { background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 32px; height: 32px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; } .action-btn:hover { background: rgba(0,0,0,0.8); } .action-btn.delete { background: #fa5252; } .action-btn.save { background: #40c057; } .action-btn.cancel { background: #868e96; } .msg-content { cursor: text; -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; } .msg-content::selection { background: #ffe066; } .msg-wrapper.longpress-pending .msg-bubble::after { content: ""; position: absolute; right: 10px; bottom: 10px; width: 22px; height: 22px; border: 3px solid rgba(51,154,240,0.25); border-top-color: #339af0; border-radius: 50%; pointer-events: none; z-index: 30; animation: bookmarkLongPressSpin 0.8s linear infinite; } .msg-wrapper.bookmark-swipe-left .msg-bubble { transform: translateX(-22px); } .msg-wrapper.bookmark-swipe-right .msg-bubble { transform: translateX(22px); } .msg-wrapper:is(.bookmark-swipe-left,.bookmark-swipe-right) .msg-bubble::after { content: "🔖"; position: absolute; bottom: 10px; padding: 5px 7px; border-radius: 999px; background: rgba(51,154,240,0.9); color: #fff; font-size: 15px; line-height: 1; pointer-events: none; z-index: 30; } .msg-wrapper.bookmark-swipe-left .msg-bubble::after { right: 10px; } .msg-wrapper.bookmark-swipe-right .msg-bubble::after { left: 10px; } @keyframes bookmarkLongPressSpin { to { transform: rotate(360deg); } } mark[class^="hl-color-"] { color: #333; padding: 0 4px; border-radius: 4px; font-weight: 500; background-color: transparent; } .hl-color-yellow { background-color: #fdfd96 !important; } .hl-color-pink { background-color: #ffb7b2 !important; } .hl-color-green { background-color: #c1e1c1 !important; } .hl-color-blue { background-color: #aec6cf !important; } .hl-color-purple { background-color: #cbaacb !important; } .hl-toolbar { position: absolute; z-index: 9999; background: #343a40; padding: 6px; border-radius: 8px; display: flex; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: opacity 0.2s, transform 0.2s; opacity: 0; pointer-events: none; transform: translateY(10px); } .hl-toolbar.show { opacity: 1; pointer-events: auto; transform: translateY(0); } .hl-btn { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: 0.2s; padding: 0; } .hl-btn:hover { transform: scale(1.15); border-color: white; } .hl-remove { background: transparent; color: #adb5bd; border: none; display: flex; align-items: center; justify-content: center; font-size: 13px; width: 24px; cursor: pointer; } .hl-remove:hover { color: #fa5252; transform: scale(1.15); } .rsb-backdrop { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 199; cursor: pointer; } .rsb-close-mobile { display: none; } @media (max-width: 768px) { .container { padding: 10px 6px; gap: 10px; padding-bottom: max(50px, env(safe-area-inset-bottom)); } .msg-bubble { max-width: 100%; width: 100%; font-size: 15px; padding: 12px 14px; border-radius: 14px; } .msg-wrapper.user, .msg-wrapper.assistant { justify-content: center; } .edit-area { min-width: 100%; } .header h1 { font-size: 15px; } .rsb-toggle-btn .rsb-toggle-label { display: none; } .right-sidebar { position: fixed !important; right: 0; top: 0; bottom: 0; z-index: 201; width: 85vw !important; max-width: 320px; transform: translateX(100%); transition: transform 0.25s ease !important; overflow: visible; border-left: 1px solid var(--sidebar-border); box-shadow: none; } body.rsb-open .right-sidebar { transform: translateX(0); box-shadow: -4px 0 15px rgba(0,0,0,0.15); } body.rsb-open .rsb-backdrop { display: block; } .rsb-close-mobile { display: flex; width: 44px; height: 44px; border: none; background: none; border-radius: 8px; cursor: pointer; align-items: center; justify-content: center; color: #fa5252; flex-shrink: 0; } .rsb-close-mobile:hover { background: #fff5f5; } }</style></head><body><div class="header"><h1>${this.escapeHtml(title)}</h1><div class="header-actions"><button class="dark-toggle-btn" id="darkModeBtn" onclick="toggleDarkMode()" title="다크모드">${ICONS.moon}</button><button class="rsb-toggle-btn" onclick="toggleRightSidebar()">${ICONS.sidebar}<span class="rsb-toggle-label"> 도구</span></button></div></div><div class="main-wrap"><div class="content-area"><div class="container">${contentHtml}</div></div><div class="right-sidebar" id="rightSidebar"><div class="rsb-icons"><button class="rsb-close-mobile" onclick="toggleRightSidebar()" title="닫기">${ICONS.close}</button><button class="rsb-icon" data-panel="search" onclick="showPanel('search')" title="검색">${ICONS.search}<span class="icon-tooltip">검색</span></button><button class="rsb-icon active" data-panel="note" onclick="showPanel('note')" title="유저 노트">${ICONS.note}<span class="icon-tooltip">유저 노트</span></button><button class="rsb-icon" data-panel="bookmark" onclick="showPanel('bookmark')" title="북마크">${ICONS.bookmark}<span class="icon-tooltip">북마크</span></button><button class="rsb-icon" data-panel="highlight" onclick="showPanel('highlight')" title="형광펜" style="color:#f59f00;">${ICONS.highlight}<span class="icon-tooltip">형광펜</span></button><div class="rsb-divider"></div><button class="rsb-icon" data-panel="edit" onclick="showPanel('edit')" title="편집 설정">${ICONS.settings}<span class="icon-tooltip">편집 설정</span></button></div><div class="rsb-content"><div class="rsb-panel" id="panel-search"><div class="rsb-panel-header">🔍 검색</div><div class="search-bar"><input type="text" id="searchInput" class="search-input" placeholder="메시지 내용 검색..." oninput="onSearchInput(this.value)" enterkeyhint="search"><span class="search-count" id="searchCount"></span><button class="search-clear" onclick="clearSearch()" title="초기화">✕</button></div><div class="rsb-panel-body" id="searchResults"><div class="rsb-empty">2글자 이상 입력하세요</div></div></div><div class="rsb-panel active" id="panel-note"><div class="rsb-panel-header">📝 유저 노트</div><div class="rsb-panel-body">${userNote ? escapedNote : '<span class="rsb-empty">유저 노트가 없습니다</span>'}</div></div><div class="rsb-panel" id="panel-bookmark"><div class="rsb-panel-header">🔖 북마크</div><div class="rsb-panel-body" id="bookmarkList"><div class="rsb-empty">북마크가 없습니다</div></div></div><div class="rsb-panel" id="panel-highlight"><div class="rsb-panel-header">🖍️ 형광펜</div><div class="rsb-panel-body" id="highlightList"><div class="rsb-empty">형광펜이 없습니다</div></div></div><div class="rsb-panel" id="panel-edit"><div class="rsb-panel-header">⚙️ 편집 설정</div><div class="rsb-panel-body"><div class="viewer-mode-box"><div class="viewer-mode-title">작품</div><div class="viewer-mode-buttons"><button type="button" id="novelModeChoice" class="viewer-mode-btn" data-selected="0" aria-pressed="false" onclick="setViewerMode('novel')"><span>✓</span> 소설형 UI</button><button type="button" id="chatModeChoice" class="viewer-mode-btn" data-selected="1" aria-pressed="true" onclick="setViewerMode('chat')"><span>✓</span> 채팅형 UI</button></div></div><div class="viewer-slider-row"><div class="viewer-slider-head"><span>대화창 폭 조절</span><span id="chatWidthVal" class="viewer-slider-value">기본</span></div><input type="range" id="chatWidthSlider" class="viewer-slider" min="-50" max="100" step="1" value="0" oninput="changeChatWidth(this.value)" aria-label="대화창 폭 조절"></div><div class="viewer-slider-row"><div class="viewer-slider-head"><span>이미지 사이즈 조절</span><span id="imgSizeVal" class="viewer-slider-value">기본</span></div><input type="range" id="imgSizeSlider" class="viewer-slider" min="20" max="100" step="1" value="100" oninput="changeImgSize(this.value)" aria-label="이미지 사이즈 조절"></div><div class="edit-panel-row"><span class="edit-panel-label">${ICONS.edit} 편집 모드 <span id="editModeStatus" class="mode-badge off">OFF</span></span><button class="edit-panel-btn" onclick="toggleEditMode()">전환</button></div><div class="edit-panel-row"><span class="edit-panel-label">${ICONS.moon} 다크 모드 <span id="darkModeStatus" class="mode-badge off">OFF</span></span><button class="edit-panel-btn" onclick="toggleDarkMode()">전환</button></div><div class="edit-panel-row"><span class="edit-panel-label">형광펜 전체 제거</span><button class="edit-panel-btn danger" onclick="clearAllHighlights()">초기화</button></div><div style="margin-top:20px;"><button class="edit-panel-btn primary" onclick="downloadModifiedHtml()" style="width:100%; padding:10px; display:flex; align-items:center; justify-content:center; gap:6px;">${ICONS.disk} 변경 사항 저장 (다운로드)</button></div></div></div></div></div></div><div id="hl-toolbar" class="hl-toolbar"><button class="hl-btn hl-color-yellow" data-color="yellow" title="노랑"></button><button class="hl-btn hl-color-pink" data-color="pink" title="분홍"></button><button class="hl-btn hl-color-green" data-color="green" title="초록"></button><button class="hl-btn hl-color-blue" data-color="blue" title="파랑"></button><button class="hl-btn hl-color-purple" data-color="purple" title="보라"></button><button class="hl-remove" title="형광펜 지우기">❌</button></div><div class="rsb-backdrop" onclick="toggleRightSidebar()" ontouchend="event.preventDefault();toggleRightSidebar()"></div><script>${this.getEmbeddedScript(userNote, title)}<\/script></body></html>`;
        }
    };

    const Cleaner = {
        defaults: {
            imageMarkdown: true,
            imageUrl: true,
            comments: true,
            blankLines: true,
            ooc: false,
            markdown: false,
            codeMode: 'keep'
        },
        getOptions() {
            try {
                const raw = JSON.parse(localStorage.getItem(CONFIG.cleanerOptionsKey) || '{}');
                return { ...this.defaults, ...raw };
            } catch {
                return { ...this.defaults };
            }
        },
        setOptions(options) {
            const next = { ...this.defaults, ...(options || {}) };
            delete next.enabled;
            if (!['keep', 'unwrap', 'remove'].includes(next.codeMode)) next.codeMode = 'keep';
            try { localStorage.setItem(CONFIG.cleanerOptionsKey, JSON.stringify(next)); } catch {}
            return next;
        },
        isActive(options) {
            const opts = { ...this.defaults, ...(options || this.getOptions()) };
            return !!(opts.imageMarkdown || opts.imageUrl || opts.comments || opts.blankLines || opts.ooc || opts.markdown || opts.codeMode !== 'keep');
        },
        cleanText(text, options) {
            const opts = { ...this.defaults, ...(options || this.getOptions()) };
            let out = String(text ?? '');
            if (!this.isActive(opts)) return out;
            if (opts.codeMode === 'remove') out = out.replace(/```[\s\S]*?```/g, '');
            else if (opts.codeMode === 'unwrap') out = out.replace(/```[^\r\n]*(?:\r?\n)?([\s\S]*?)```/g, '$1');
            if (opts.ooc) out = out.replace(/<ooc_lore_context\b[^>]*>[\s\S]*?<\/ooc_lore_context>/gi, '');
            if (opts.imageMarkdown) out = out.replace(/!\[[^\]\r\n]*\]\([^)]+?\)/g, '');
            if (opts.imageUrl) out = out.replace(/^[ \t]*https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:[?#]\S*)?[ \t]*$/gmi, '');
            if (opts.comments) {
                out = out.replace(/<!--[\s\S]*?-->/g, '');
                out = out.replace(/^[ \t]*\[\/\/\]:\s*#\s*\([^\r\n]*\)[ \t]*$/gmi, '');
            }
            if (opts.markdown) {
                out = out.replace(/(\*\*|__)([\s\S]*?)\1/g, '$2');
                out = out.replace(/~~([\s\S]*?)~~/g, '$1');
            }
            if (opts.blankLines) out = out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
            return out;
        },
        cleanMessages(messages, options) {
            const opts = { ...this.defaults, ...(options || this.getOptions()) };
            if (!Array.isArray(messages) || !this.isActive(opts)) return messages;
            return messages.map(m => {
                if (!m || typeof m !== 'object') return m;
                const next = { ...m };
                if (typeof next.content === 'string') next.content = this.cleanText(next.content, opts);
                return next;
            });
        },
        buildTxt(messages, charName, options) {
            const cleaned = this.cleanMessages(messages, options);
            return (cleaned || []).map(m => `[${m.role === 'user' ? 'User' : charName}]\n${m.content || ''}\n`).join('\n===\n\n');
        },
        buildJson(payload, options) {
            const opts = { ...this.defaults, ...(options || this.getOptions()) };
            const out = { ...(payload || {}) };
            if (Array.isArray(out.messages)) out.messages = this.cleanMessages(out.messages, opts);
            return JSON.stringify(out, null, 2);
        }
    };

    const UI = {
        _editingHistory: false,
        _histSearchQuery: '',
        _histSearchCursor: 0,
        _histSearchFocused: false,
        _mergeFiles: [],
        init() { GM_addStyle(styles); this.createFab(); this.initTampermonkeyMenu(); this.initSiteOptionsEntry(); },
        createFab() {
            const btn = document.createElement('div'); btn.className = 'hcd-fab'; btn.innerHTML = ICONS.download;
            const badge = document.createElement('div'); badge.className = 'hcd-badge hide'; badge.id = 'hcd-fab-badge';
            btn.appendChild(badge);
            btn.title = 'CrackSafe';

            const posKey = 'HCD_fabPos';
            try {
                const saved = JSON.parse(localStorage.getItem(posKey));
                if (saved) {
                    btn.style.right = 'auto'; btn.style.bottom = 'auto';
                    btn.style.left = Math.min(saved.x, window.innerWidth - 56) + 'px';
                    btn.style.top = Math.min(saved.y, window.innerHeight - 56) + 'px';
                }
            } catch {}

            let isDragging = false, startX, startY, startLeft, startTop, moved;
            const onStart = (e) => {
                const t = e.touches ? e.touches[0] : e;
                const rect = btn.getBoundingClientRect();
                startX = t.clientX; startY = t.clientY;
                startLeft = rect.left; startTop = rect.top;
                moved = 0; isDragging = true;
                btn.style.transition = 'none'; btn.style.cursor = 'grabbing';
            };
            const onMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const t = e.touches ? e.touches[0] : e;
                const dx = t.clientX - startX, dy = t.clientY - startY;
                moved = Math.abs(dx) + Math.abs(dy);
                let nx = startLeft + dx, ny = startTop + dy;
                nx = Math.max(0, Math.min(nx, window.innerWidth - 56));
                ny = Math.max(0, Math.min(ny, window.innerHeight - 56));
                btn.style.right = 'auto'; btn.style.bottom = 'auto';
                btn.style.left = nx + 'px'; btn.style.top = ny + 'px';
            };
            const onEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                btn.style.cursor = ''; btn.style.transition = '';
                const rect = btn.getBoundingClientRect();
                try { localStorage.setItem(posKey, JSON.stringify({ x: rect.left, y: rect.top })); } catch {}
                if (moved < 5) this.openPanel();
            };
            btn.addEventListener('mousedown', onStart); btn.addEventListener('touchstart', onStart, { passive: false });
            document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd);

            const updateBadge = () => {
                const info = API.getUrlInfo();
                const enabled = this.getOption(CONFIG.siteOptionButtonKey, false);
                btn.classList.toggle('hcd-hidden-by-sidebar', !!info && enabled);
                btn.style.display = info ? 'flex' : 'none';
                this.updateSiteDownloadBadges();
                if (!info) return;
                const cursor = History.getCursor(info.chatroomId);
                if (!cursor || !cursor.savedAt) { badge.className = 'hcd-badge hide'; return; }
                const hours = (Date.now() - new Date(cursor.savedAt).getTime()) / 3600000;
                if (hours < 1) { badge.className = 'hcd-badge fresh'; badge.textContent = '<1h'; }
                else if (hours < 6) { badge.className = 'hcd-badge warn'; badge.textContent = Math.floor(hours) + 'h'; }
                else { badge.className = 'hcd-badge old'; badge.textContent = hours < 24 ? Math.floor(hours) + 'h' : Math.floor(hours / 24) + 'd'; }
            };
            setInterval(updateBadge, 5000); updateBadge();
            document.body.appendChild(btn);
        },

        getOption(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                return raw == null ? fallback : raw === '1';
            } catch { return fallback; }
        },
        setOption(key, value) {
            try { localStorage.setItem(key, value ? '1' : '0'); } catch {}
        },
        initTampermonkeyMenu() {
            if (typeof GM_registerMenuCommand !== 'function') return;
            GM_registerMenuCommand('🔄 채팅 다운로드 버튼 위치 초기화', () => {
                try {
                    localStorage.removeItem('HCD_fabPos');
                    localStorage.removeItem('HCD_siteOptionButtonMode');
                    localStorage.removeItem('HCD_siteOptionButtonOn');
                    localStorage.setItem(CONFIG.siteOptionButtonKey, '0');
                } catch {}
                document.querySelectorAll('.hcd-site-download-entry').forEach(el => el.remove());
                this.setFabHiddenForSidebar(false);
                const fab = document.querySelector('.hcd-fab');
                if (fab) {
                    fab.style.left = '';
                    fab.style.top = '';
                    fab.style.right = '';
                    fab.style.bottom = '';
                    fab.style.display = '';
                }
                this.refreshSiteOptionsEntry();
                alert('CrackSafe 채팅 다운로드 버튼 위치를 초기화했습니다.');
            });
        },
        initSiteOptionsEntry() {
            const schedule = () => {
                const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
                clearTimeout(this._siteOptionTimer);
                if (!this._siteOptionRaf) {
                    this._siteOptionRaf = raf(() => {
                        this._siteOptionRaf = 0;
                        this.refreshSiteOptionsEntry();
                    });
                }
                let tries = 0;
                const retry = () => {
                    this.refreshSiteOptionsEntry();
                    tries += 1;
                    if (tries >= 6) return;
                    if (!this.getOption(CONFIG.siteOptionButtonKey, false) || !API.getUrlInfo()) return;
                    if (document.querySelector('.hcd-site-download-entry')) return;
                    this._siteOptionTimer = setTimeout(retry, 50);
                };
                this._siteOptionTimer = setTimeout(retry, 50);
            };
            schedule();
            try {
                this._siteOptionObserver = new MutationObserver(schedule);
                this._siteOptionObserver.observe(document.body, { childList: true, subtree: true });
            } catch {}
            setInterval(schedule, 3000);
        },
        openDownloadPanel() { this.openPanel('current'); },
        formatSaveAge(savedAt) {
            const time = new Date(savedAt || 0).getTime();
            if (!Number.isFinite(time) || time <= 0) return null;
            const hours = Math.max(0, (Date.now() - time) / 3600000);
            if (hours < 1) return { text: '<1h', cls: 'fresh' };
            if (hours < 6) return { text: Math.floor(hours) + 'h', cls: 'warn' };
            return { text: hours < 24 ? Math.floor(hours) + 'h' : Math.floor(hours / 24) + 'd', cls: 'old' };
        },
        getCurrentSaveAge() {
            const info = API.getUrlInfo();
            if (!info) return null;
            const cursor = History.getCursor(info.chatroomId);
            if (!cursor || !cursor.savedAt) return null;
            const age = this.formatSaveAge(cursor.savedAt);
            if (!age) return null;
            age.title = '마지막 저장: ' + new Date(cursor.savedAt).toLocaleString('ko-KR');
            return age;
        },
        applySiteDownloadBadge(entry) {
            if (!entry) return;
            const badge = entry.querySelector('.hcd-site-download-badge');
            if (!badge) return;
            const age = this.getCurrentSaveAge();
            if (!age) {
                badge.className = 'hcd-site-download-badge';
                badge.textContent = '';
                entry.removeAttribute('title');
                return;
            }
            badge.className = 'hcd-site-download-badge ' + age.cls;
            badge.textContent = age.text;
            entry.title = age.title;
        },
        updateSiteDownloadBadges() {
            document.querySelectorAll('.hcd-site-download-entry').forEach(entry => this.applySiteDownloadBadge(entry));
        },
        setFabHiddenForSidebar(hidden) {
            document.querySelectorAll('.hcd-fab').forEach(fab => fab.classList.toggle('hcd-hidden-by-sidebar', !!hidden));
        },
        getSiteMenuButton(row) {
            if (!row) return null;
            if (row.getAttribute && row.getAttribute('role') === 'button') return row;
            return row.querySelector && (row.querySelector(':scope > [role="button"]') || row.querySelector('[role="button"]'));
        },
        wireSiteDownloadEntry(entry) {
            entry.dataset.hcdCloneEntry = '1';
            entry.classList.add('hcd-site-download-entry');
            entry.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
            entry.querySelectorAll('[aria-current]').forEach(el => el.removeAttribute('aria-current'));
            if (entry.tagName === 'A') entry.removeAttribute('href');
            const button = this.getSiteMenuButton(entry) || entry;
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.setAttribute('aria-label', '채팅 다운로드');
            entry.querySelectorAll('a,button,input,textarea,select').forEach(el => {
                if (el === entry || el === button) return;
                el.removeAttribute('href');
                el.setAttribute('tabindex', '-1');
                el.onclick = null;
            });
            const open = (e) => { e.preventDefault(); e.stopPropagation(); this.openDownloadPanel(); };
            if (button === entry) {
                entry.onclick = open;
            } else {
                button.onclick = open;
                entry.onclick = (e) => {
                    if (e.target && (e.target === button || button.contains(e.target))) return;
                    open(e);
                };
            }
            button.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') open(e);
            };
        },
        createFallbackSiteDownloadEntry(reference) {
            const entry = document.createElement('div');
            const refClass = reference && reference.className ? String(reference.className) : '';
            entry.className = /px-2\.5|py-\[18px\]|box-content/.test(refClass) ? refClass : 'px-2.5 h-4 box-content py-[18px]';
            entry.style.cursor = 'pointer';
            entry.innerHTML =
                '<div role="button" tabindex="0" class="w-full flex h-4 items-center justify-between typo-text-base_leading-none_medium space-x-2 [&_svg]:fill-icon_tertiary ring-offset-4 ring-offset-sidebar cursor-pointer hcd-site-download-button">' +
                    '<span class="flex space-x-2 items-center hcd-site-download-left">' +
                        '<span class="hcd-site-download-icon">' + ICONS.download + '</span>' +
                        '<span class="whitespace-nowrap overflow-hidden text-ellipsis typo-text-sm_leading-none_medium hcd-site-download-label">채팅 다운로드</span>' +
                    '</span>' +
                    '<span class="hcd-site-download-badge"></span>' +
                '</div>';
            return entry;
        },
        createSiteDownloadEntry(className, reference) {
            const entry = this.createFallbackSiteDownloadEntry(reference);
            entry.classList.add(className);
            this.wireSiteDownloadEntry(entry);
            this.applySiteDownloadBadge(entry);
            return entry;
        },
        findSiteSidebarInsertPoint() {
            const blocked = '.hcd-panel-overlay,.hcd-fab,.hcd-site-download-entry';
            const noteRe = /^(?:유저\s*노트|User\s*Note)$/i;
            const textOf = (el) => (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
            const isVisible = (el) => {
                if (!el || !el.getBoundingClientRect || el.closest(blocked)) return false;
                const r = el.getBoundingClientRect();
                return r.width >= 70 && r.height >= 16 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
            };
            const hasDirectButton = (el) => Array.from(el.children || []).some(ch => ch.getAttribute && ch.getAttribute('role') === 'button');
            const isMenuShell = (el) => {
                if (!isVisible(el)) return false;
                const r = el.getBoundingClientRect();
                const cls = String(el.className || '');
                if (r.width < 150 || r.width > Math.min(560, window.innerWidth - 24)) return false;
                if (r.height < 42 || r.height > 78) return false;
                if (!el.querySelector('svg,img')) return false;
                return hasDirectButton(el) || /(?:^|\s)(?:px-2\.5|box-content|py-\[18px\])(?:\s|$)/.test(cls);
            };
            const normalizeMenuRow = (el) => {
                let row = el, best = null;
                for (let i = 0; row && i < 9; i++, row = row.parentElement) {
                    if (!isVisible(row)) continue;
                    const text = textOf(row);
                    if (!noteRe.test(text) || text.length > 100) continue;
                    if (isMenuShell(row)) best = row;
                }
                return best || el;
            };
            const scoreRow = (row, labelText) => {
                const r = row.getBoundingClientRect();
                const cs = window.getComputedStyle ? getComputedStyle(row) : null;
                const text = textOf(row);
                let score = 0;
                if (isMenuShell(row)) score += 80;
                if (hasDirectButton(row)) score += 25;
                if (r.height >= 48 && r.height <= 58) score += 25;
                if (cs && cs.display === 'block') score += 8;
                if (row.querySelector('svg,img')) score += 8;
                if (text === labelText) score += 8;
                if (r.height <= 30) score -= 55;
                if (/^(SPAN|P|STRONG|B)$/i.test(row.tagName)) score -= 50;
                return score;
            };
            const siblingMenuRef = (row, parent) => {
                const kids = Array.from(parent.children || []);
                const idx = kids.indexOf(row);
                for (let i = idx + 1; i < kids.length; i++) {
                    const el = kids[i];
                    if (el.closest(blocked) || !isMenuShell(el)) continue;
                    return el;
                }
                for (let i = idx - 1; i >= 0; i--) {
                    const el = kids[i];
                    if (el === row || el.closest(blocked) || !isMenuShell(el)) continue;
                    return el;
                }
                return row;
            };

            let best = null;
            const seen = new Set();
            const labels = Array.from(document.querySelectorAll('button,a,li,div,span,p'))
                .filter(el => {
                    if (!isVisible(el)) return false;
                    const t = textOf(el);
                    return t && t.length <= 80 && noteRe.test(t);
                });
            labels.forEach(label => {
                const labelText = textOf(label);
                const row = normalizeMenuRow(label);
                if (!row || seen.has(row)) return;
                seen.add(row);
                const text = textOf(row);
                if (!noteRe.test(text) || text.length > 100) return;
                const parent = row.parentElement;
                if (!parent || parent.closest(blocked) || !isVisible(parent)) return;
                const score = scoreRow(row, labelText);
                if (!best || score > best.score) {
                    best = { parent, after: row, cloneRef: siblingMenuRef(row, parent), score };
                }
            });
            return best ? { parent: best.parent, after: best.after, cloneRef: best.cloneRef } : null;
        },
        refreshSiteOptionsEntry() {
            const inRoom = !!API.getUrlInfo();
            const enabled = this.getOption(CONFIG.siteOptionButtonKey, false);
            const existing = Array.from(document.querySelectorAll('.hcd-site-download-entry'));

            if (!inRoom || !enabled) {
                existing.forEach(el => el.remove());
                this.setFabHiddenForSidebar(false);
                return;
            }

            this.setFabHiddenForSidebar(true);
            const target = this.findSiteSidebarInsertPoint();
            const hasTarget = !!(target && target.parent);

            if (!hasTarget) {
                existing.forEach(el => el.remove());
                return;
            }

            let entry = existing.find(el => el.classList.contains('hcd-site-download-entry'));
            if (!entry || entry.dataset.hcdCloneEntry !== '1') {
                if (entry) entry.remove();
                entry = this.createSiteDownloadEntry('hcd-site-download-entry', target.cloneRef || target.after);
            }
            existing.forEach(el => { if (el !== entry) el.remove(); });
            if (target.after && target.after.parentElement === target.parent) {
                if (entry.previousElementSibling !== target.after) target.after.insertAdjacentElement('afterend', entry);
            } else if (entry.parentElement !== target.parent) {
                target.parent.appendChild(entry);
            }
            this.updateSiteDownloadBadges();
        },
        renderOptions() {
            const container = document.getElementById('hcd-options-container');
            if (!container) return;
            const sidebarOn = this.getOption(CONFIG.siteOptionButtonKey, false);
            const cleaner = Cleaner.getOptions();
            container.innerHTML = [
                '<div class="hcd-option-card">',
                    '<div class="hcd-option-title">채팅 다운로드</div>',
                    '<label class="hcd-toggle-row">',
                        '<input type="checkbox" id="hcd-opt-site-options"' + (sidebarOn ? ' checked' : '') + '>',
                        '<span class="hcd-switch"></span>',
                        '<span><div class="hcd-toggle-text">사이드바에 다운로드 항목 표시</div></span>',
                    '</label>',
                '</div>',
                '<div class="hcd-option-card">',
                    '<div class="hcd-option-title">🧹 로그 클리너</div>',
                    '<div class="hcd-option-desc">체크한 항목만 TXT/JSON 저장 직전에 정리합니다. HTML 저장, 백업/복구, 기록 구조는 건드리지 않습니다.</div>',
                    '<div class="hcd-cleaner-grid">',
                        this.cleanerCheckHtml('imageMarkdown', '이미지 마크다운 제거', '![](url), ![텍스트](url) 삭제', cleaner.imageMarkdown),
                        this.cleanerCheckHtml('imageUrl', '이미지 URL 줄 제거', '이미지 확장자로 끝나는 단독 URL 줄 삭제', cleaner.imageUrl),
                        this.cleanerCheckHtml('comments', 'HTML/마크다운 주석 제거', '<!-- -->, [//]: # (...) 삭제', cleaner.comments),
                        this.cleanerCheckHtml('blankLines', '빈 줄 정리', '3줄 이상 연속 빈 줄과 줄 끝 공백 압축', cleaner.blankLines),
                        this.cleanerCheckHtml('ooc', '로어 전용 OOC 제거', '<ooc_lore_context> 블록 전체 삭제 · 기본 OFF', cleaner.ooc),
                        this.cleanerCheckHtml('markdown', '일반 마크다운 장식 제거', '**굵게**, __굵게__, ~~취소선~~ 장식만 삭제 · 기본 OFF', cleaner.markdown),
                    '</div>',
                    '<div class="hcd-cleaner-select-row"><span>코드블록 처리</span><select class="hcd-select" id="hcd-clean-code" style="font-size:12px;padding:6px 28px 6px 10px;min-height:32px"><option value="keep"' + (cleaner.codeMode === 'keep' ? ' selected' : '') + '>유지</option><option value="unwrap"' + (cleaner.codeMode === 'unwrap' ? ' selected' : '') + '>경계만 삭제</option><option value="remove"' + (cleaner.codeMode === 'remove' ? ' selected' : '') + '>블록 전체 삭제</option></select></div>',
                '</div>'
            ].join('');
            const cb = container.querySelector('#hcd-opt-site-options');
            if (cb) cb.onchange = () => {
                this.setOption(CONFIG.siteOptionButtonKey, cb.checked);
                this.refreshSiteOptionsEntry();
                this.updateStatus(cb.checked ? '채팅 다운로드 항목을 표시합니다.' : '채팅 다운로드 항목을 숨겼습니다.', 'success');
            };
            this.wireCleanerOptions(container);
        },
        cleanerCheckHtml(key, title, desc, checked) {
            const safeTitle = this._escHtml(title);
            const safeDesc = this._escHtml(desc);
            return '<label class="hcd-cleaner-row"><input type="checkbox" data-clean-key="' + key + '"' + (checked ? ' checked' : '') + '><span><div class="hcd-cleaner-name">' + safeTitle + '</div><div class="hcd-cleaner-help">' + safeDesc + '</div></span></label>';
        },
        collectCleanerOptions(container) {
            const prev = Cleaner.getOptions();
            const next = { ...prev };
            container.querySelectorAll('[data-clean-key]').forEach(input => { next[input.dataset.cleanKey] = input.checked; });
            const code = container.querySelector('#hcd-clean-code');
            if (code) next.codeMode = code.value;
            return Cleaner.setOptions(next);
        },
        wireCleanerOptions(container) {
            const save = () => {
                const opts = this.collectCleanerOptions(container);
                this.updateStatus(Cleaner.isActive(opts) ? '체크한 클리너 항목을 적용합니다.' : '클리너 항목이 모두 꺼졌습니다.', 'success');
            };
            container.querySelectorAll('[data-clean-key],#hcd-clean-code').forEach(el => { el.onchange = save; });
        },

        openPanel(initialTab = 'current') {
            if (document.querySelector('.hcd-panel-overlay')) return;
            this._cancelToken = null;
            const info = API.getUrlInfo();
            const cursor = info ? History.getCursor(info.chatroomId) : null;
            const savedFormat = History.getIncrFormat();

            const overlay = document.createElement('div');
            overlay.className = 'hcd-panel-overlay';

            const incrBlock = cursor ? `
                <div class="hcd-incr-box">
                    <strong>📌 이어서 저장 가능</strong><br>
                    마지막 저장: ${new Date(cursor.savedAt).toLocaleString('ko-KR')}<br>
                    저장된 메시지: ${cursor.totalSaved}개
                    <div class="hcd-incr-row">
                        <select class="hcd-select" id="hcd-incr-format">
                            <option value="txt"${savedFormat === 'txt' ? ' selected' : ''}>TXT</option>
                            <option value="json"${savedFormat === 'json' ? ' selected' : ''}>JSON</option>
                            <option value="html"${savedFormat === 'html' ? ' selected' : ''}>HTML</option>
                        </select>
                        <button class="hcd-incr-btn" id="hcd-incr-save">${ICONS.forward} 이어서 저장</button>
                    </div>
                </div>` : '';

            overlay.innerHTML = `
                <div class="hcd-panel">
                    <div class="hcd-header"><div class="hcd-title">CrackSafe</div><button class="hcd-close-btn">${ICONS.close}</button></div>
                    <div class="hcd-tabs">
                        <button class="hcd-tab active" data-tab="current">현재 채팅</button>
                        <button class="hcd-tab" data-tab="history">저장 기록</button>
                        <button class="hcd-tab" data-tab="options">옵션</button>
                        <button class="hcd-tab" data-tab="tools">도구</button>
                    </div>
                    <div id="tab-current" class="hcd-content active">
                        ${incrBlock}
                        <div class="hcd-label" style="margin-bottom:12px">전체 대화 저장 (최대 ${CONFIG.hardLimit.toLocaleString()}개)</div>
                        <div id="hcd-current-actions" class="hcd-actions">
                            <button class="hcd-btn" data-type="html">${ICONS.play} HTML</button>
                            <button class="hcd-btn secondary" data-type="txt">${ICONS.play} TXT</button>
                            <button class="hcd-btn secondary" data-type="json">${ICONS.play} JSON</button>
                        </div>
                        <div class="hcd-ctrl-bar" id="hcd-current-ctrl">
                            <div class="hcd-ctrl-progress"><div class="hcd-ctrl-text" id="hcd-ctrl-text">수집 준비 중...</div><div class="hcd-ctrl-sub" id="hcd-ctrl-sub"></div></div>
                            <button class="hcd-stop-btn" id="hcd-stop-current" title="중지">${ICONS.stop}</button>
                        </div>
                        <label class="hcd-clip-row" for="hcd-clip-cb">
                            <input type="checkbox" class="hcd-clip-cb" id="hcd-clip-cb"${Clipboard.isOn() ? ' checked' : ''}>
                            <span class="hcd-clip-label">TXT/JSON 저장 시 클립보드에도 복사</span>
                            <span class="hcd-clip-hint">iOS 지원</span>
                        </label>
                    </div>
                    <div id="tab-history" class="hcd-content"><div id="hcd-history-container"></div></div>
                    <div id="tab-options" class="hcd-content"><div id="hcd-options-container"></div></div>
                    <div id="tab-tools" class="hcd-content"><div id="hcd-tools-container"></div></div>
                    <div class="hcd-status"></div>
                </div>`;

            document.body.appendChild(overlay);
            overlay.querySelector('.hcd-close-btn').onclick = () => { if (this._cancelToken) { if (!confirm('다운로드가 진행 중입니다. 정말 닫으시겠습니까?')) return; this._cancelToken.cancelled = true; } overlay.remove(); };
            overlay.onclick = (e) => { if (e.target === overlay && !this._cancelToken) overlay.remove(); };
            overlay.querySelectorAll('.hcd-tab').forEach(t => t.onclick = () => {
                overlay.querySelectorAll('.hcd-tab').forEach(x => x.classList.remove('active'));
                overlay.querySelectorAll('.hcd-content').forEach(x => x.classList.remove('active'));
                t.classList.add('active'); overlay.querySelector(`#tab-${t.dataset.tab}`).classList.add('active');
                if (t.dataset.tab === 'history') { this._editingHistory = false; this._histSearchFocused = false; this.renderHistory(); }
                if (t.dataset.tab === 'options') this.renderOptions();
                if (t.dataset.tab === 'tools') this.renderTools();
            });
            overlay.querySelectorAll('#tab-current .hcd-btn').forEach(b => {
                b.onclick = () => {
                    const type = b.dataset.type;
                    const wantClip = Clipboard.isOn() && type !== 'html';
                    let clipResolve = null;
                    if (wantClip) {
                        try {
                            if (navigator.clipboard?.write) {
                                const textPromise = new Promise(r => { clipResolve = r; });
                                const item = new ClipboardItem({ 'text/plain': textPromise.then(t => new Blob([t], { type: 'text/plain;charset=utf-8' })) });
                                navigator.clipboard.write([item]).catch(() => {});
                            }
                        } catch {}
                    }
                    this.processCurrentChat(type, clipResolve);
                };
            });
            overlay.querySelector('#hcd-stop-current').onclick = () => { if (this._cancelToken && confirm('다운로드를 취소하시겠습니까?\n수집된 데이터는 저장되지 않습니다.')) this._cancelToken.cancelled = true; };
            const clipCb = overlay.querySelector('#hcd-clip-cb');
            if (clipCb) clipCb.onchange = () => Clipboard.setOn(clipCb.checked);
            const incrFmtEl = overlay.querySelector('#hcd-incr-format');
            if (incrFmtEl) incrFmtEl.onchange = () => History.setIncrFormat(incrFmtEl.value);
            const incrBtn = overlay.querySelector('#hcd-incr-save');
            const initialPanelTab = overlay.querySelector(`.hcd-tab[data-tab="${initialTab}"]`);
            if (initialPanelTab && initialTab !== 'current') initialPanelTab.click();

            if (incrBtn) incrBtn.onclick = () => {
                const fmt = overlay.querySelector('#hcd-incr-format')?.value || 'txt';
                const wantClip = Clipboard.isOn() && fmt !== 'html';
                let clipResolve = null;
                if (wantClip) {
                    try { if (navigator.clipboard?.write) { const tp = new Promise(r => { clipResolve = r; }); const item = new ClipboardItem({ 'text/plain': tp.then(t => new Blob([t], { type: 'text/plain;charset=utf-8' })) }); navigator.clipboard.write([item]).catch(() => {}); } } catch {}
                }
                this.processIncrementalSave(info.chatroomId, fmt, clipResolve);
            };
        },

        renderHistory() {
            const container = document.getElementById('hcd-history-container'); if (!container) return;
            const groups = History.getGrouped();
            const isEditing = this._editingHistory;
            if (!groups.length) {
                const emptyBackup = `<div class="hcd-backup-bar"><span>💾 세이브</span><button class="hcd-backup-btn" id="hcd-backup-export" disabled style="opacity:.4;cursor:default">내보내기</button><button class="hcd-backup-btn import" id="hcd-backup-import">불러오기</button><input type="file" id="hcd-backup-file" accept=".json" style="display:none"></div>`;
                container.innerHTML = emptyBackup + '<div class="hcd-history-empty">저장 기록이 없습니다</div>';
                const importBtn = container.querySelector('#hcd-backup-import');
                const fileInput = container.querySelector('#hcd-backup-file');
                importBtn.onclick = () => fileInput.click();
                fileInput.onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const mode = confirm('기존 데이터에 병합할까요?\n\n[확인] = 병합\n[취소] = 덮어쓰기'); const result = History.importBackup(ev.target.result, !mode); this.updateStatus(`불러오기 완료! (기록 ${result.historyCount}건, 커서 ${result.cursorCount}개)`, 'success'); this.renderHistory(); } catch (err) { this.updateStatus('불러오기 실패: ' + err.message, 'error'); } }; reader.readAsText(file); fileInput.value = ''; };
                return;
            }
            const totalCount = groups.reduce((s, g) => s + g.items.length, 0);
            const savedFormat = History.getIncrFormat();
            const stats = History.getStats();
            const cursorsAll = History.getAllCursors();
            const searchVal = this._histSearchQuery || '';

            const statsHtml = `<div class="hcd-stats">
                <div class="hcd-stat"><div class="hcd-stat-val">${stats.totalSaves}</div><div class="hcd-stat-label">총 저장</div></div>
                <div class="hcd-stat"><div class="hcd-stat-val">${stats.totalMessages.toLocaleString()}</div><div class="hcd-stat-label">메시지</div></div>
                <div class="hcd-stat"><div class="hcd-stat-val">${stats.charCount}</div><div class="hcd-stat-label">작품</div></div>
            </div>`;

            const searchHtml = `<div class="hcd-hsearch"><input type="text" class="hcd-hsearch-input" id="hcd-hist-search" placeholder="작품명 검색..." value="${this._escHtml(searchVal)}"><button class="hcd-htool-btn primary" id="hcd-hist-search-btn" style="flex-shrink:0;min-width:44px;min-height:36px">${ICONS.search}</button></div>`;

            const batchDisabled = cursorsAll.length < 2 ? ' disabled' : '';
            const batchHtml = `<button class="hcd-batch-btn" id="hcd-batch-incr"${batchDisabled}>${ICONS.forward} 전체 이어서 저장 (${cursorsAll.length}개 채팅방)</button>`;

            const toolbar = `<div class="hcd-history-toolbar${isEditing ? ' hcd-history-editing' : ''}">
                <span class="hcd-history-count">총 ${totalCount}건 · ${groups.length}개 작품</span>
                <div class="hcd-htool-normal"><button class="hcd-htool-btn" id="hcd-hist-edit-btn">편집</button></div>
                <div class="hcd-htool-actions"><button class="hcd-htool-btn primary" id="hcd-hist-selall">전체 선택</button><button class="hcd-htool-btn danger" id="hcd-hist-delbtn">선택 삭제</button><button class="hcd-htool-btn" id="hcd-hist-cancel">취소</button></div>
            </div>`;

            const filteredGroups = searchVal ? groups.filter(g => g.charName.toLowerCase().includes(searchVal.toLowerCase())) : groups;

            const groupsHtml = filteredGroups.map((g, gi) => {
                const cursor = History.getCursor(g.chatroomId);
                const hasCursor = !!cursor && g.chatroomId !== '_full_backup_';

                const groupCbHtml = `<input type="checkbox" class="hcd-history-group-cb" data-group-idx="${gi}" title="이 그룹 전체 선택">`;

                const itemsHtml = g.items.map(h => {
                    const d = new Date(h.timestamp);
                    const dateStr = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                    const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                    const typeLabel = h.incremental ? 'incr' : (h.type || 'html');
                    const msgCount = h.messageCount || h.turnCount || '?';
                    const displayName = h.label || '';
                    return `<div class="hcd-history-item" data-id="${h.id}">
                        <input type="checkbox" class="hcd-history-cb" data-hid="${h.id}">
                        <span class="hcd-history-type ${typeLabel}">${typeLabel}</span>
                        <div class="hcd-history-info">
                            ${displayName ? `<div class="hcd-history-name">${this._escHtml(displayName)}</div>` : ''}
                            <div class="hcd-history-meta">${dateStr} ${timeStr} · ${msgCount}개 메시지</div>
                        </div>
                        <button class="hcd-history-copy" data-cid="${h.id}" title="현재 채팅방으로 복제 (분기 채팅방 연결)">${ICONS.copy}</button>
                        <button class="hcd-history-rename" data-rid="${h.id}" title="이름 변경">${ICONS.pencil}</button>
                    </div>`;
                }).join('');
                const incrBtnHtml = hasCursor ? `<button class="hcd-history-group-incr" data-crid="${g.chatroomId}" title="이어서 저장">${ICONS.forward} 이어서</button>` : '';
                return `<div class="hcd-history-group open" data-group="${gi}"><div class="hcd-history-group-header" data-toggle="${gi}">${groupCbHtml}${incrBtnHtml}<span class="hcd-history-group-name">${this._escHtml(g.charName)}</span><span class="hcd-history-group-count">${g.items.length}건</span></div><div class="hcd-history-group-body">${itemsHtml}</div></div>`;
            }).join('');

            const noResult = filteredGroups.length === 0 && searchVal ? '<div class="hcd-history-empty">검색 결과가 없습니다</div>' : '';

            const fmtBar = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:12px;color:var(--hcd-text3)"><span>이어서 저장 형식:</span><select class="hcd-select" id="hcd-hist-incr-fmt" style="font-size:12px;padding:4px 24px 4px 8px;min-height:28px"><option value="txt"${savedFormat === 'txt' ? ' selected' : ''}>TXT</option><option value="json"${savedFormat === 'json' ? ' selected' : ''}>JSON</option><option value="html"${savedFormat === 'html' ? ' selected' : ''}>HTML</option></select></div>`;

            const backupBar = `<div class="hcd-backup-bar">
                <span>💾 세이브</span>
                <button class="hcd-backup-btn" id="hcd-backup-export">내보내기</button>
                <button class="hcd-backup-btn import" id="hcd-backup-import">불러오기</button>
                <input type="file" id="hcd-backup-file" accept=".json" style="display:none">
            </div>`;

            container.innerHTML = statsHtml + searchHtml + toolbar + batchHtml + fmtBar + backupBar + `<div class="hcd-history-list${isEditing ? ' hcd-history-editing' : ''}">${groupsHtml}${noResult}</div>`;

            const searchInput = container.querySelector('#hcd-hist-search');
            const searchBtn = container.querySelector('#hcd-hist-search-btn');
            const doSearch = () => { if (searchInput) { this._histSearchQuery = searchInput.value; this._histSearchCursor = searchInput.selectionStart; this._histSearchFocused = true; this.renderHistory(); } };
            if (searchInput) {
                searchInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } };
                if (this._histSearchFocused) { searchInput.focus(); const pos = this._histSearchCursor != null ? this._histSearchCursor : searchInput.value.length; searchInput.setSelectionRange(pos, pos); }
            }
            if (searchBtn) searchBtn.onclick = doSearch;

            const batchBtn = container.querySelector('#hcd-batch-incr');
            if (batchBtn) batchBtn.onclick = () => this.processBatchIncrSave();

            const fmtEl = container.querySelector('#hcd-hist-incr-fmt');
            if (fmtEl) fmtEl.onchange = () => History.setIncrFormat(fmtEl.value);

            container.querySelectorAll('[data-toggle]').forEach(hdr => {
                hdr.onclick = (e) => {
                    if (e.target.closest('.hcd-history-group-incr') || e.target.closest('.hcd-history-group-cb')) return;
                    hdr.closest('.hcd-history-group').classList.toggle('open');
                };
            });

            container.querySelectorAll('.hcd-history-group-incr').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation(); const fmt = container.querySelector('#hcd-hist-incr-fmt')?.value || 'txt';
                    const wantClip = Clipboard.isOn() && fmt !== 'html';
                    let clipResolve = null;
                    if (wantClip) { try { if (navigator.clipboard?.write) { const tp = new Promise(r => { clipResolve = r; }); const item = new ClipboardItem({ 'text/plain': tp.then(t => new Blob([t], { type: 'text/plain;charset=utf-8' })) }); navigator.clipboard.write([item]).catch(() => {}); } } catch {} }
                    this.processIncrementalSave(btn.dataset.crid, fmt, clipResolve);
                };
            });

            container.querySelectorAll('.hcd-history-copy').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const histId = btn.dataset.cid;
                    const info = API.getUrlInfo();

                    if (!info) {
                        alert('현재 열려있는 채팅방이 없습니다.\n분기된 새로운 채팅방에 먼저 접속한 상태에서 이 기능을 실행해주세요.');
                        return;
                    }

                    const targetChatroomId = info.chatroomId;
                    const allItems = History.getAll();
                    const sourceItem = allItems.find(h => h.id === histId);

                    if (!sourceItem) return;
                    if (sourceItem.chatroomId === targetChatroomId) {
                        alert('이미 현재 접속해 있는 채팅방의 기록입니다.\n복제할 필요가 없습니다.');
                        return;
                    }

                    if (!confirm(`[${sourceItem.charName}]의 과거 저장 기록을\n현재 접속 중인 채팅방(분기)으로 복제하시겠습니까?\n\n이 기능을 사용하면 분기된 채팅방에서도 이어서 저장이 가능해집니다.`)) return;

                    const newItem = {
                        ...sourceItem,
                        chatroomId: targetChatroomId,
                        label: (sourceItem.label || sourceItem.charName) + ' (복제됨)',
                        timestamp: new Date().toISOString()
                    };
                    delete newItem.id;
                    History.add(newItem);

                    const sourceCursor = History.getCursor(sourceItem.chatroomId);
                    if (sourceCursor) {
                        History.setCursor(targetChatroomId, {
                            ...sourceCursor,
                            savedAt: new Date().toISOString()
                        });
                    } else {
                        History.setCursor(targetChatroomId, {
                            lastMessageId: sourceItem.lastMessageId,
                            totalSaved: sourceItem.messageCount || 0,
                            savedAt: new Date().toISOString(),
                            charName: sourceItem.charName
                        });
                    }

                    this.updateStatus('채팅방 복제가 완료되었습니다! 이제 현재 채팅방에서 이어서 저장이 가능합니다.', 'success');
                    this.renderHistory();
                };
            });

            container.querySelectorAll('.hcd-history-group-cb').forEach(cb => {
                cb.onclick = (e) => {
                    e.stopPropagation();
                    const groupDiv = cb.closest('.hcd-history-group');
                    const childCbs = groupDiv.querySelectorAll('.hcd-history-cb');
                    childCbs.forEach(child => child.checked = cb.checked);
                };
            });

            container.querySelectorAll('.hcd-history-cb').forEach(cb => {
                cb.onclick = (e) => {
                    e.stopPropagation();
                    const groupDiv = cb.closest('.hcd-history-group');
                    const groupCb = groupDiv.querySelector('.hcd-history-group-cb');
                    const childCbs = groupDiv.querySelectorAll('.hcd-history-cb');
                    const allChecked = [...childCbs].every(c => c.checked);
                    if (groupCb) groupCb.checked = allChecked;
                };
            });

            container.querySelectorAll('.hcd-history-rename').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.rid;
                    const item = History.getAll().find(h => h.id === id);
                    const current = item?.label || '';
                    const newName = prompt('저장 기록 이름 변경:', current);
                    if (newName === null) return;
                    History.rename(id, newName);
                    this.renderHistory();
                };
            });

            container.querySelector('#hcd-backup-export').onclick = () => {
                const json = History.exportBackup();
                const dateSuffix = new Date().toISOString().slice(0, 10);
                Platform.download(json, `크랙다운로더_세이브_${dateSuffix}.json`, 'application/json');
                this.updateStatus('세이브 파일 내보내기 완료!', 'success');
            };

            const importBtn = container.querySelector('#hcd-backup-import');
            const fileInput = container.querySelector('#hcd-backup-file');
            importBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const mode = confirm('기존 데이터에 병합할까요?\n\n[확인] = 병합 (기존 + 불러온 데이터)\n[취소] = 덮어쓰기 (기존 데이터 삭제)');
                        const result = History.importBackup(ev.target.result, !mode);
                        this.updateStatus(`불러오기 완료! (기록 ${result.historyCount}건, 커서 ${result.cursorCount}개)`, 'success');
                        this.renderHistory();
                    } catch (err) {
                        console.error(err);
                        this.updateStatus('불러오기 실패: ' + err.message, 'error');
                    }
                };
                reader.readAsText(file);
                fileInput.value = '';
            };

            const editBtn = container.querySelector('#hcd-hist-edit-btn');
            if (editBtn) editBtn.onclick = () => { this._editingHistory = true; this.renderHistory(); };

            const cancelBtn = container.querySelector('#hcd-hist-cancel');
            if (cancelBtn) cancelBtn.onclick = () => { this._editingHistory = false; this.renderHistory(); };

            const selAllBtn = container.querySelector('#hcd-hist-selall');
            if (selAllBtn) {
                selAllBtn.onclick = () => {
                    const itemCbs = container.querySelectorAll('.hcd-history-cb');
                    const allCbs = container.querySelectorAll('.hcd-history-cb, .hcd-history-group-cb');
                    const allChecked = [...itemCbs].every(c => c.checked);
                    allCbs.forEach(c => c.checked = !allChecked);
                    selAllBtn.textContent = allChecked ? '전체 선택' : '전체 해제';
                };
            }

            const delBtn = container.querySelector('#hcd-hist-delbtn');
            if (delBtn) {
                delBtn.onclick = () => {
                    const ids = [...container.querySelectorAll('.hcd-history-cb:checked')].map(c => c.dataset.hid);
                    if (!ids.length) { alert('삭제할 항목을 선택해주세요.'); return; }
                    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
                    History.removeMany(ids);
                    this._editingHistory = false;
                    this.renderHistory();
                };
            }
        },

        _escHtml(t) { return (t || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
        updateStatus(msg, type = 'info') { const el = document.querySelector('.hcd-status'); if (!el) return; el.innerHTML = type === 'loading' ? `${ICONS.spinner} ${msg}` : msg; el.style.color = type === 'error' ? 'var(--hcd-status-err)' : (type === 'success' ? 'var(--hcd-status-ok)' : 'var(--hcd-text3)'); },

        // ==========================================
        // 도구 탭 (파일 병합 + EPUB 변환기 통합)
        // ==========================================
        renderTools() {
            const container = document.getElementById('hcd-tools-container'); if (!container) return;
            const files = this._mergeFiles;
            const fileListHtml = files.length ? files.map((f, i) => `<div class="hcd-merge-item"><span class="hcd-merge-item-name">${this._escHtml(f.name)}</span><span class="hcd-merge-item-size">${(f.size / 1024).toFixed(1)}KB</span><button class="hcd-merge-item-del" data-mi="${i}">✕</button></div>`).join('') : '';

            container.innerHTML = `
                <div class="hcd-label">채팅 EPUB 변환기</div>
                <div style="font-size:12px;color:var(--hcd-text3);margin-bottom:12px;line-height:1.5">현재 접속 중인 채팅 내용을 리디북스 호환 EPUB 전자책으로 변환합니다.</div>
                <button class="hcd-btn" id="hcd-epub-open-modal" style="width:100%;margin-bottom:20px;">${ICONS.download} EPUB 변환 설정 및 다운로드</button>

                <div class="hcd-label">파일 병합</div>
                <div style="font-size:12px;color:var(--hcd-text3);margin-bottom:12px;line-height:1.5">이어서 저장된 TXT/JSON 파일 여러 개를 하나로 합칩니다.<br>파일 순서대로 병합되며, 드래그 또는 클릭으로 추가하세요.</div>
                <div class="hcd-merge-zone" id="hcd-merge-zone"><div class="hcd-merge-zone-text"><strong>파일을 여기에 드롭</strong>하거나 클릭하여 선택<br>(TXT / JSON)</div><input type="file" id="hcd-merge-input" accept=".txt,.json" multiple style="display:none"></div>
                ${fileListHtml ? `<div class="hcd-merge-list">${fileListHtml}</div>` : ''}
                <div style="display:flex;gap:8px">
                    <button class="hcd-btn secondary" id="hcd-merge-clear" style="flex:1"${files.length ? '' : ' disabled'}>초기화</button>
                    <button class="hcd-btn" id="hcd-merge-run" style="flex:2"${files.length >= 2 ? '' : ' disabled'}>병합 다운로드 (${files.length}개)</button>
                </div>`;

            // EPUB 변환 모달 열기 버튼 이벤트
            const epubBtn = container.querySelector('#hcd-epub-open-modal');
            if (epubBtn) epubBtn.onclick = () => this.openEpubModal();

            const zone = container.querySelector('#hcd-merge-zone');
            const input = container.querySelector('#hcd-merge-input');
            zone.onclick = () => input.click();
            zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = 'var(--hcd-accent)'; };
            zone.ondragleave = () => { zone.style.borderColor = ''; };
            zone.ondrop = (e) => { e.preventDefault(); zone.style.borderColor = ''; this._addMergeFiles(e.dataTransfer.files); };
            input.onchange = (e) => { this._addMergeFiles(e.target.files); input.value = ''; };

            container.querySelectorAll('.hcd-merge-item-del').forEach(btn => {
                btn.onclick = () => { this._mergeFiles.splice(parseInt(btn.dataset.mi), 1); this.renderTools(); };
            });
            const clearBtn = container.querySelector('#hcd-merge-clear');
            if (clearBtn) clearBtn.onclick = () => { this._mergeFiles = []; this.renderTools(); };
            const runBtn = container.querySelector('#hcd-merge-run');
            if (runBtn) runBtn.onclick = () => this._executeMerge();
        },

        // ==========================================
        // EPUB 변환 전용 모달 및 빌드 로직
        // ==========================================
        getFormattedTimestamp() {
            const now = new Date();
            return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        },

        getDefaultEpubFileName() {
            const info = API.getUrlInfo();
            if (info) {
                // 현재 캐릭터/챗룸 정보를 가져오거나 기본값 반환
                const activeTitleEl = document.querySelector('header h1, .chat-title, title');
                if (activeTitleEl && activeTitleEl.textContent) {
                    const cleanT = activeTitleEl.textContent.trim().replace(/\.[^/.]+$/, "");
                    if (cleanT && cleanT !== 'Crack') return `${cleanT}_${this.getFormattedTimestamp()}`;
                }
            }
            return `clean_log_${this.getFormattedTimestamp()}`;
        },

        openEpubModal() {
            const oldModal = document.getElementById('hcd-epub-modal-box');
            if (oldModal) oldModal.remove();

            const modal = document.createElement('div');
            modal.id = 'hcd-epub-modal-box';
            modal.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--hcd-bg2, #fff); color:var(--hcd-text2, #333); padding:24px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.3); z-index:20000; font-family:inherit; min-width:320px; border:1px solid var(--hcd-border, #ccc);";

            const defaultName = this.getDefaultEpubFileName();

            modal.innerHTML = `
                <h3 style="margin-top:0; margin-bottom:15px; font-size:16px; font-weight:700;">EPUB 변환 설정</h3>
                <div style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px; font-size:13px; font-weight:bold;">파일 이름</label>
                    <input type="text" id="hcd-epub-filename" value="${defaultName}" style="width:100%; padding:10px; box-sizing:border-box; border:1px solid var(--hcd-border, #ccc); border-radius:8px; background:var(--hcd-input-bg, #fff); color:var(--hcd-text, #000); font-size:14px;">
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block; margin-bottom:10px; cursor:pointer; font-size:13px;">
                        <input type="checkbox" id="hcd-trans-option" checked style="margin-right:6px; accent-color:var(--hcd-accent);"> 다국어 대화 형식을 [한글 --- 원문]으로 변경
                    </label>
                    <label style="display:block; cursor:pointer; font-size:13px;">
                        <input type="checkbox" id="hcd-user-option" checked style="margin-right:6px; accent-color:var(--hcd-accent);"> [User] 태그 및 줄바꿈 제거
                    </label>
                </div>
                <div style="text-align:right;">
                    <button id="hcd-epub-cancel" style="margin-right:8px; background:var(--hcd-surface, #eee); color:var(--hcd-text3, #333); border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600;">취소</button>
                    <button id="hcd-epub-confirm" style="background:linear-gradient(135deg,var(--hcd-accent),var(--hcd-accent2)); color:white; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:bold;">변환 시작</button>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('hcd-epub-cancel').onclick = () => modal.remove();
            document.getElementById('hcd-epub-confirm').onclick = () => {
                const isMultiLang = document.getElementById('hcd-trans-option').checked;
                const isUserTag = document.getElementById('hcd-user-option').checked;
                let fileName = document.getElementById('hcd-epub-filename').value.trim();
                if (!fileName) fileName = `clean_log_${this.getFormattedTimestamp()}`;

                modal.remove();
                this.executeEpubGeneration(isMultiLang, isUserTag, fileName);
            };
        },

        async executeEpubGeneration(isMultiLang, isUserTag, fileName) {
            this.updateStatus('채팅 메시지 가져오는 중...', 'loading');
            try {
                const info = API.getUrlInfo();
                let text = "";
                let title = fileName;

                if (info) {
                    const detail = await API.fetchDetail(info.chatroomId);
                    const charName = detail.story?.name || detail.character?.name || 'Chat';
                    title = charName;
                    const messages = await API.fetchAllMessages(info.chatroomId, null);
                    if (!messages.length) throw new Error('대화 내용이 없습니다.');
                    text = Cleaner.buildTxt(messages, charName);
                } else {
                    // 현재 페이지에 백업 패널이나 텍스트 영역이 있다면 폴백으로 긁어오기
                    const textArea = document.querySelector('#cleanOutput');
                    text = textArea ? textArea.value : document.body.innerText;
                }

                if (!text.trim()) {
                    alert("변환할 대화 내용이 없습니다!");
                    this.updateStatus('변환 실패: 대화 내용 없음', 'error');
                    return;
                }

                if (isUserTag) {
                    text = text.replace(/\[User\]\s*/g, "");
                }

                if (isMultiLang) {
                    text = text.replace(/(.+｜)"[^"]*"\s*\(([^)]+)\)/g, '$1"$2"\n---\n$&');
                }

                const zip = new JSZip();
                zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
                zip.file("META-INF/container.xml", '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
                zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${fileName}</dc:title><dc:creator>CrackSafe</dc:creator><dc:identifier id="bookid">urn:uuid:${Math.random().toString(36).substring(2, 11)}</dc:identifier><dc:language>ko</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="content" href="content.html" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="content"/></spine></package>`);
                zip.file("OEBPS/toc.ncx", `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx-2005-1.dtd" version="2.005-1"><head><meta name="dtb:uid" content="urn:uuid:12345"/><meta name="dtb:depth" content="1"/></head><docTitle><text>${fileName}</text></docTitle><navMap><navPoint id="navPoint-1" playOrder="1"><navLabel><text>본문</text></navLabel><content src="content.html"/></navPoint></navMap></ncx>`);
                zip.file("OEBPS/content.html", `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko"><head><title>${fileName}</title><meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8" /></head><body><pre style="white-space: pre-wrap; font-family: sans-serif; line-height: 1.6;">${text}</pre></body></html>`);

                const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
                saveAs(blob, `${fileName}.epub`);
                this.updateStatus('EPUB 변환 및 다운로드 완료!', 'success');
            } catch (e) {
                console.error(e);
                this.updateStatus('EPUB 생성 실패: ' + e.message, 'error');
            }
        },

        _addMergeFiles(fileList) {
            for (const f of fileList) {
                if (!f.name.endsWith('.txt') && !f.name.endsWith('.json')) continue;
                this._mergeFiles.push(f);
            }
            this.renderTools();
        },

        async _executeMerge() {
            if (this._mergeFiles.length < 2) return;
            this.updateStatus('파일 병합 중...', 'loading');
            try {
                const contents = [];
                for (const f of this._mergeFiles) {
                    contents.push(await f.text());
                }
                const isJson = this._mergeFiles[0].name.endsWith('.json');
                let merged, ext, mime;
                if (isJson) {
                    const allMessages = [];
                    for (const c of contents) {
                        try { const d = JSON.parse(c); allMessages.push(...(d.messages || [])); } catch { allMessages.push({ role: 'system', content: '[파싱 실패 파일]' }); }
                    }
                    merged = JSON.stringify({ messages: allMessages, merged: true, fileCount: this._mergeFiles.length, mergedAt: new Date().toISOString() }, null, 2);
                    ext = 'json'; mime = 'application/json';
                } else {
                    merged = contents.join('\n\n===== [파일 구분] =====\n\n');
                    ext = 'txt'; mime = 'text/plain';
                }
                const dateSuffix = new Date().toISOString().slice(0, 10);
                await Platform.download(merged, `병합_${this._mergeFiles.length}개_${dateSuffix}.${ext}`, mime);
                this.updateStatus(`병합 완료! (${this._mergeFiles.length}개 파일 → 1개)`, 'success');
                this._mergeFiles = []; this.renderTools();
            } catch (e) { console.error(e); this.updateStatus('병합 실패: ' + e.message, 'error'); }
        },

        async processBatchIncrSave() {
            const cursors = History.getAllCursors();
            if (cursors.length < 2) return;
            if (!confirm(`${cursors.length}개 채팅방의 새 메시지를 일괄 저장합니다.\n채팅방 간 2초 간격으로 진행됩니다. 계속할까요?`)) return;
            const fmt = History.getIncrFormat();
            let success = 0, fail = 0, noNew = 0;
            for (let i = 0; i < cursors.length; i++) {
                const c = cursors[i];
                this.updateStatus(`[${i + 1}/${cursors.length}] ${c.charName || '알 수 없음'} 처리 중...`, 'loading');
                try {
                    const newMessages = await API.fetchMessagesUntilId(c.chatroomId, c.lastMessageId);
                    if (!newMessages.length) { noNew++; continue; }
                    await new Promise(r => setTimeout(r, 300));
                    const detail = await API.fetchDetail(c.chatroomId);
                    const charName = detail.story?.name || detail.character?.name || c.charName || 'Unknown';
                    const now = new Date(); const dateSuffix = now.toISOString().slice(0, 10) + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
                    const fileName = `${charName}_이어서_${dateSuffix}`;
                    const type = (fmt === 'json') ? 'json' : 'txt';
                    if (type === 'json') {
                        await Platform.download(Cleaner.buildJson({ messages: newMessages, incremental: true, previouslySaved: c.totalSaved }), `${fileName}.json`, 'application/json');
                    } else {
                        const txt = Cleaner.buildTxt(newMessages, charName);
                        await Platform.download(txt, `${fileName}.txt`, 'text/plain');
                    }
                    const newLastMsg = newMessages[newMessages.length - 1];
                    History.add({ type, charName, chatroomId: c.chatroomId, messageCount: newMessages.length, incremental: true, lastMessageId: newLastMsg._id });
                    History.setCursor(c.chatroomId, { lastMessageId: newLastMsg._id, totalSaved: c.totalSaved + newMessages.length, savedAt: new Date().toISOString(), charName });
                    success++;
                } catch (e) {
                    console.error(e);
                    fail++;
                    if (e.message === '네트워크 오류') { this.updateStatus(`⚠ 인터넷 연결 끊김. 나머지 ${cursors.length - i - 1}개 건너뜀.`, 'error'); break; }
                    if (e.message === 'RATE_LIMITED') { this.updateStatus('⚠ 서버 제한. 30초 대기 후 재개...', 'loading'); await new Promise(r => setTimeout(r, 30000)); }
                }
                if (i < cursors.length - 1) await new Promise(r => setTimeout(r, 2000));
            }
            this.updateStatus(`일괄 저장 완료! (성공 ${success}, 새 메시지 없음 ${noNew}${fail ? `, 실패 ${fail}` : ''})`, success > 0 ? 'success' : 'info');
            this.renderHistory();
        },

        async processCurrentChat(type, clipResolve) {
            const actionsEl = document.getElementById('hcd-current-actions');
            const ctrlEl = document.getElementById('hcd-current-ctrl');
            const ctrlText = document.getElementById('hcd-ctrl-text');
            const ctrlSub = document.getElementById('hcd-ctrl-sub');
            try {
                const info = API.getUrlInfo(); if (!info) throw new Error('채팅방 정보를 찾을 수 없습니다.');
                this._cancelToken = { cancelled: false };
                if (actionsEl) actionsEl.style.display = 'none';
                if (ctrlEl) ctrlEl.classList.add('active');
                ctrlText.textContent = '채팅방 정보 확인 중...'; ctrlSub.textContent = '';

                const detail = await API.fetchDetail(info.chatroomId);
                const charName = detail.story?.name || detail.character?.name || 'Unknown';
                ctrlText.textContent = `${charName} 수집 중...`;

                const messages = await API.fetchAllMessages(info.chatroomId, this._cancelToken,
                    (count, chunks) => { ctrlText.textContent = `${charName} (${count.toLocaleString()}개 수집)`; ctrlSub.textContent = `${chunks}회 요청 · ${type.toUpperCase()} 형식`; }
                );

                if (!messages.length) throw new Error('대화 내용이 없습니다.');
                ctrlText.textContent = '파일 생성 중...'; ctrlSub.textContent = `${messages.length.toLocaleString()}개 메시지`;

                const now = new Date(); const dateSuffix = now.toISOString().slice(0, 10) + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
                const fileName = `${charName}_${dateSuffix}`;
                let clipText = null;
                if (type === 'html') {
                    const userNote = detail.story?.userNote?.content || detail.character?.userNote?.content || null;
                    await Platform.download(Generator.buildHtml(charName, messages, userNote), `${fileName}.html`, 'text/html');
                } else if (type === 'json') {
                    const { story, character, ...metaNoNote } = detail; const cleanMeta = { ...metaNoNote };
                    if (story) { const { userNote, ...rest } = story; cleanMeta.story = rest; }
                    if (character) { const { userNote, ...rest } = character; cleanMeta.character = rest; }
                    clipText = Cleaner.buildJson({ meta: cleanMeta, messages });
                    await Platform.download(clipText, `${fileName}.json`, 'application/json');
                } else {
                    clipText = Cleaner.buildTxt(messages, charName);
                    await Platform.download(clipText, `${fileName}.txt`, 'text/plain');
                }

                let clipStatus = '';
                if (clipText && Clipboard.isOn()) {
                    if (clipResolve) { clipResolve(clipText); clipStatus = ' + 클립보드 복사됨'; }
                    else { const ok = await Clipboard.copy(clipText); if (ok) clipStatus = ' + 클립보드 복사됨'; }
                } else if (clipResolve) { clipResolve(''); }
                const lastMsg = messages[messages.length - 1];
                History.add({ type, charName, chatroomId: info.chatroomId, messageCount: messages.length, incremental: false, lastMessageId: lastMsg._id });
                History.setCursor(info.chatroomId, { lastMessageId: lastMsg._id, totalSaved: messages.length, savedAt: new Date().toISOString(), charName });
                this.updateStatus(`저장 완료! (${messages.length.toLocaleString()}개 메시지${clipStatus})`, 'success');
            } catch (e) {
                if (clipResolve) clipResolve('');
                if (e.message === 'USER_CANCELLED') { this.updateStatus('다운로드가 취소되었습니다.', 'info'); }
                else { console.error(e); this.updateStatus(e.message, 'error'); }
            } finally {
                this._cancelToken = null;
                if (actionsEl) actionsEl.style.display = '';
                if (ctrlEl) ctrlEl.classList.remove('active');
            }
        },

        async processIncrementalSave(chatroomId, format, clipResolve) {
            try {
                if (!chatroomId) throw new Error('채팅방 정보를 찾을 수 없습니다.');
                const cursor = History.getCursor(chatroomId);
                if (!cursor) throw new Error('이전 저장 기록이 없습니다. 먼저 전체 저장을 해주세요.');
                this.updateStatus('새 메시지 확인 중...', 'loading');
                const newMessages = await API.fetchMessagesUntilId(chatroomId, cursor.lastMessageId,
                    (count, chunks) => this.updateStatus(`새 메시지 탐색 중... (${count}개 발견, ${chunks}회 요청)`, 'loading')
                );
                await new Promise(r => setTimeout(r, 300));
                const detail = await API.fetchDetail(chatroomId);
                if (!newMessages.length) { if (clipResolve) clipResolve(''); this.updateStatus('새로운 메시지가 없습니다.', 'info'); return; }
                const charName = detail.story?.name || detail.character?.name || 'Unknown';
                const now = new Date(); const dateSuffix = now.toISOString().slice(0, 10) + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
                const type = format || 'txt';
                const fileName = `${charName}_이어서_${dateSuffix}`;
                History.setIncrFormat(type);
                let clipText = null;
                if (type === 'html') {
                    const userNote = detail.story?.userNote?.content || detail.character?.userNote?.content || null;
                    await Platform.download(Generator.buildHtml(charName, newMessages, userNote), `${fileName}.html`, 'text/html');
                } else if (type === 'json') {
                    clipText = Cleaner.buildJson({ messages: newMessages, incremental: true, previouslySaved: cursor.totalSaved });
                    await Platform.download(clipText, `${fileName}.json`, 'application/json');
                } else {
                    clipText = Cleaner.buildTxt(newMessages, charName);
                    await Platform.download(clipText, `${fileName}.txt`, 'text/plain');
                }
                let clipStatus = '';
                if (clipText && Clipboard.isOn()) {
                    if (clipResolve) { clipResolve(clipText); clipStatus = ' + 복사됨'; }
                    else { const ok = await Clipboard.copy(clipText); if (ok) clipStatus = ' + 복사됨'; }
                } else if (clipResolve) { clipResolve(''); }
                const newLastMsg = newMessages[newMessages.length - 1];
                History.add({ type, charName, chatroomId, messageCount: newMessages.length, incremental: true, lastMessageId: newLastMsg._id });
                History.setCursor(chatroomId, { lastMessageId: newLastMsg._id, totalSaved: cursor.totalSaved + newMessages.length, savedAt: new Date().toISOString(), charName });
                this.updateStatus(`이어서 저장 완료! (새 메시지 ${newMessages.length}개${clipStatus})`, 'success');
            } catch (e) {
                if (clipResolve) clipResolve('');
                console.error(e);
                if (e.message === '네트워크 오류') this.updateStatus('⚠ 인터넷 연결이 끊겼습니다. 네트워크 확인 후 다시 시도해주세요.', 'error');
                else if (e.message === 'RATE_LIMITED') this.updateStatus('⚠ 서버 요청 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.', 'error');
                else if (e.message === '로그인이 필요합니다.') this.updateStatus('⚠ 로그인이 만료되었습니다. 페이지를 새로고침해주세요.', 'error');
                else this.updateStatus('⚠ 이어서 저장 실패: ' + e.message, 'error');
            }
        }
    };

    UI.init();
})();
