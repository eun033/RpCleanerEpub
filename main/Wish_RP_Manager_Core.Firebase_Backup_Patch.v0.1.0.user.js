// ==UserScript==
// @name         🪽 Wish RP Manager Core · Cloud Patch
// @namespace    local.rp.context.manager.firebase.backup.patch
// @version      1.0.0
// @description  Wish RP Manager Core v1.5.3에 Firebase·Google Drive 백업과 ChatGPT 재구축 전송을 추가하는 동반 패치입니다.
// @author       User
// @license      All Rights Reserved
// @updateURL    https://github.com/eun033/RpCleanerEpub/raw/refs/heads/main/main/Wish_RP_Manager_Core.Firebase_Backup_Patch.v0.1.0.user.js
// @downloadURL  https://github.com/eun033/RpCleanerEpub/raw/refs/heads/main/main/Wish_RP_Manager_Core.Firebase_Backup_Patch.v0.1.0.user.js
// @match        https://crack.wrtn.ai/*
// @match        https://chatgpt.com/*
// @match        https://www.chatgpt.com/*
// @match        https://chat.openai.com/*
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// @connect      *.firebaseio.com
// @connect      *.firebasedatabase.app
// @connect      www.googleapis.com
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_openInTab
// @grant        GM_getTab
// @grant        GM_saveTab
// @grant        GM_getTabs
// @grant        GM_addElement
// @grant        window.focus
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const PATCH_VERSION = '1.0.0';
  const SUPPORTED_CORE_VERSION = '1.5.3';
  const CORE_RUNTIME_KEY = '__WISH_RP_MANAGER_V1__';
  const DB_NAME = 'WishRPManagerDB_v2';
  const STORES = ['rooms', 'characterLibraries', 'cognitionRooms', 'runtime', 'autoHistory'];
  const SETTINGS_KEY = 'WISH_RP_FIREBASE_PATCH_SETTINGS_V1';
  const SESSION_KEY = 'WISH_RP_FIREBASE_PATCH_SESSION_V1';
  const RESTORE_NOTICE_KEY = 'WISH_RP_FIREBASE_PATCH_RESTORED_V1';
  const CLOUD_PROVIDER_KEY = 'WISH_RP_CLOUD_PROVIDER_V1';
  const DRIVE_CLIENT_KEY = 'WISH_RP_GOOGLE_DRIVE_CLIENT_ID_V1';
  const DRIVE_FOLDER_NAME = 'Wish-Core-Backups';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const CHAT_TRANSFER_KEY = 'WISH_RP_CHATGPT_TRANSFER_V1';
  const CHAT_FOCUS_KEY = 'WISH_RP_CHATGPT_FOCUS_V1';
  const CHAT_RECENT_TAB_KEY = 'WISH_RP_CHATGPT_RECENT_TAB_V1';
  const CHAT_TITLE_PENDING_KEY = 'WISH_RP_CHATGPT_TITLE_PENDING_V1';
  const CHAT_TRANSFER_TTL = 12 * 60 * 60 * 1000;
  const CHAT_TRANSFER_MESSAGE = '파일 내용 확인 후 지침 실행해줘';
  const IS_CHATGPT = /^(?:www\.)?chatgpt\.com$|^chat\.openai\.com$/i.test(location.hostname);
  // 배포 파일에는 개인 Firebase 정보나 Google OAuth Client ID를 넣지 않습니다.
  const DEFAULTS = Object.freeze({ apiKey:'', databaseURL:'', email:'' });
  const META_ROOT = 'rpManagerBackupMeta';
  const DATA_ROOT = 'rpManagerBackupData';
  const MANAGER_ID = 'wish-rp-manager-core';
  const GUIDE_BASE_VERSION = '1.5.0';
  const GUIDE_STORAGE_KEYS = Object.freeze({
    externalMemory:'Wish-RP-Manager-Core-external-memory-guide-v1',
    externalPeople:'Wish-RP-Manager-Core-external-people-guide-v1',
    apiBundleMemory:'Wish-RP-Manager-Core-native-memory-guide-v1',
    apiBundlePeople:'Wish-RP-Manager-Core-native-people-guide-v1',
    apiLoreBundle:'wish-rp-core-prompt-apiLoreBundle-v1',
    apiCommon:'wish-rp-core-prompt-v1-apiCommon',
    apiMemory:'wish-rp-core-prompt-v1-apiMemory',
    apiObserve:'wish-rp-core-prompt-v1-apiObserve',
    apiSpeech:'wish-rp-core-prompt-v1-apiSpeech',
    apiRelationships:'wish-rp-core-prompt-v1-apiRelationships',
    apiDate:'wish-rp-core-prompt-v1-apiDate',
    apiDelta:'wish-rp-core-prompt-v1-apiDelta',
    apiRecall:'wish-rp-core-prompt-v1-apiRecall',
    apiIndex:'wish-rp-core-prompt-v1-apiIndex',
    apiLoreConversion:'wish-rp-core-prompt-v1-apiLoreConversion',
    externalAll:'wish-rp-core-prompt-v1-externalAll',
    externalRelationships:'wish-rp-core-prompt-v1-externalRelationships',
    externalSecondary:'wish-rp-core-prompt-v1-externalSecondary',
    manualRelay:'wish-rp-core-prompt-v1-manualRelay',
    currentState:'WISH_RP_api_guide_currentState_v1',
    logSummary:'WISH_RP_api_guide_logSummary_v1',
    loreAuto:'WISH_RP_guide_lore_auto_v1',
    loreExternal:'WISH_RP_guide_lore_external_v1',
  });
  const DEFAULT_EXTRA_PRESET_KEY = 'WISH_RP_default_extra_preset_v1';

  let busy = false;
  let scanQueued = false;
  let coreMismatchNotified = false;
  let secondaryCaptureRequestedAt = 0;
  let chatTransferCache;
  let chatAttachBusy = false;
  let chatTabToken = '';
  let chatTabData = null;
  let chatLastFocusedAt = Date.now();
  let lastFocusRequestId = '';
  let titleRenameBusy = false;
  let titleRetryAfter = 0;
  let pendingChatTitle = null;
  try { pendingChatTitle = JSON.parse(sessionStorage.getItem(CHAT_TITLE_PENDING_KEY) || 'null'); } catch (_) {}
  let cloudProvider = ['koofr', 'firebase', 'drive'].includes(gmRead(CLOUD_PROVIDER_KEY, 'koofr')) ? gmRead(CLOUD_PROVIDER_KEY, 'koofr') : 'koofr';
  let cloudRows = [];
  let cloudSelectedId = '';
  let cloudError = '';
  let cloudLoaded = false;
  let cloudLoading = false;
  const apiDrafts = new Map();
  const firebaseAutoListed = new WeakSet();
  const driveAutoListed = new WeakSet();
  const driveScriptPrepared = new WeakSet();
  let driveAccessToken = '';
  let driveExpiresAt = 0;
  let driveTokenClient = null;
  let driveIdentityPromise = null;
  let driveRows = [];
  let driveSelectedId = '';
  let driveLoaded = false;
  let driveLoading = false;
  let driveBusy = false;
  let driveError = '';

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
  const clone = value => {
    if (value == null) return value;
    try { return structuredClone(value); }
    catch (_) { return JSON.parse(JSON.stringify(value)); }
  };
  const runtime = () => {
    try { return unsafeWindow?.[CORE_RUNTIME_KEY] || window[CORE_RUNTIME_KEY] || null; }
    catch (_) { return window[CORE_RUNTIME_KEY] || null; }
  };
  function coreVersion() {
    const value = runtime();
    if (typeof value === 'string') return value.match(/@([\d.]+)$/)?.[1] || '';
    return String(value?.version || document.querySelector('#wish-rp-root .m3-sub-line span')?.textContent?.match(/Wish Core\s+([\d.]+)/)?.[1] || '');
  }
  const bridge = () => {
    try { return unsafeWindow?.__WishCognitionBridge || window.__WishCognitionBridge || null; }
    catch (_) { return window.__WishCognitionBridge || null; }
  };

  function gmRead(key, fallback = null) {
    try {
      const raw = GM_getValue(key, null);
      if (raw == null || raw === '') return fallback;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) { return fallback; }
  }
  function gmWrite(key, value) {
    try { GM_setValue(key, value == null ? null : JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function legacyTransferKindForName(filename) {
    const name = String(filename || '');
    if (/^Wish-2차재구축-전체\.txt$/i.test(name)) return 'secondary';
    if (/^Wish-재구축-\d+of\d+\.txt$/i.test(name)) return 'full';
    return '';
  }
  function validTransfer(value) {
    if (!value || !Array.isArray(value.files) || !value.files.length) return null;
    if (value.ready === false) return null;
    if (Number(value.expiresAt || 0) <= Date.now()) {
      gmWrite(CHAT_TRANSFER_KEY, null);
      return null;
    }
    return value;
  }
  function loadChatTransfer() { return validTransfer(gmRead(CHAT_TRANSFER_KEY, null)); }
  function currentApiChatId() {
    const patterns = [/^\/stories\/[^/]+\/episodes\/([^/?#]+)/, /^\/characters\/[^/]+\/chats\/([^/?#]+)/, /^\/u\/[^/]+\/c\/([^/?#]+)/];
    for (const pattern of patterns) { const match = location.pathname.match(pattern); if (match) return decodeURIComponent(match[1]); }
    return '';
  }
  function currentRoomDisplayName() {
    const visible = document.querySelector('#wish-rp-root .m3-room-titlebar strong')?.textContent?.trim();
    if (visible) return visible;
    const rid = currentApiChatId();
    try {
      const saved = JSON.parse(localStorage.getItem('WISH_RP_room_display_names_v1') || '{}');
      const alias = saved?.aliases?.[rid];
      if (typeof alias === 'string' && alias.trim()) return alias.trim();
    } catch (_) {}
    return `RP_${rid.slice(-8) || 'chat'}`;
  }
  function safeFilenamePart(value) {
    return String(value || 'RP').normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'RP';
  }
  function crackToken() {
    const row = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('access_token='));
    return row ? decodeURIComponent(row.slice('access_token='.length)) : '';
  }
  function crackJson(url) {
    const token = crackToken();
    if (!token) return Promise.reject(new Error('크랙 로그인 토큰을 찾지 못했습니다.'));
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method:'GET', url, timeout:20000,
      headers:{ Authorization:`Bearer ${token}`, Accept:'application/json, text/plain, */*', platform:'web', 'wrtn-locale':'ko-KR' },
      onload:response => {
        let data;
        try { data = JSON.parse(String(response.responseText || '')); } catch (_) {}
        if (response.status >= 200 && response.status < 300 && data) resolve(data);
        else reject(Object.assign(new Error(`크랙 대화 조회 실패 (HTTP ${response.status || 0})`), { status:Number(response.status || 0) }));
      },
      onerror:() => reject(new Error('크랙 대화 조회 네트워크 오류')),
      ontimeout:() => reject(new Error('크랙 대화 조회 시간 초과')),
    }));
  }
  async function currentCompletedTurnCount() {
    const rid = currentApiChatId();
    if (!rid) throw new Error('현재 채팅방 ID를 찾지 못했습니다.');
    let cursor = '', crackFallback = false;
    const roles = [], seen = new Set(), cursors = new Set();
    for (;;) {
      const suffix = `${encodeURIComponent(rid)}/messages?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      let payload;
      try { payload = await crackJson(`${crackFallback?'https://crack-api.wrtn.ai/crack-gen/v3/chats/':'https://contents-api.wrtn.ai/character-chat/v3/chats/'}${suffix}`); }
      catch (error) {
        if (!crackFallback && !roles.length && [404, 405].includes(error.status)) { crackFallback = true; continue; }
        throw error;
      }
      const data = payload?.data || payload || {}, page = data.messages;
      if (!Array.isArray(page)) throw new Error('크랙 대화 목록 형식을 확인하지 못했습니다.');
      for (const message of page) {
        const id = String(message?._id || message?.id || message?.messageId || '');
        const role = String(message?.role || message?.speaker || '');
        if (!id || !['user','assistant','system'].includes(role) || seen.has(id)) continue;
        seen.add(id); roles.push(role);
      }
      const next = data.nextCursor == null ? '' : String(data.nextCursor);
      if (!next) break;
      if (cursors.has(next)) throw new Error('크랙 대화 cursor가 반복됐습니다.');
      cursors.add(next); cursor = next;
    }
    roles.reverse();
    let waiting = false, count = 0;
    for (const role of roles) {
      if (role === 'user') waiting = true;
      else if (role === 'assistant' && waiting) { count++; waiting = false; }
    }
    return count;
  }
  function visibleCompletedTurnCount() {
    const roots = [...document.querySelectorAll('[data-message-id],[data-message-group-id]')];
    let waiting = false, count = 0;
    for (const root of roots) {
      const role = String(root.getAttribute('data-message-author-role') || root.dataset?.role || root.getAttribute('data-role') || '').toLowerCase();
      if (role === 'user') waiting = true;
      else if (role === 'assistant' && waiting) { count++; waiting = false; }
    }
    return count;
  }
  function chatConversationPath(value) {
    try {
      const url = new URL(value, 'https://chatgpt.com');
      if (url.protocol !== 'https:' || !/^(?:www\.)?chatgpt\.com$|^chat\.openai\.com$/i.test(url.hostname)) return '';
      return url.pathname.match(/\/(?:c)\/[^/]+/)?.[0] || '';
    } catch (_) { return ''; }
  }
  function chooseChatTab(tabs, targetUrl = '') {
    const target = chatConversationPath(targetUrl);
    const eligible = tabs.filter(tab => tab?.token && /^https:\/\/(?:(?:www\.)?chatgpt\.com|chat\.openai\.com)(?:\/|$)/i.test(tab.url || ''));
    eligible.sort((a, b) => Number(b.lastFocusedAt || 0) - Number(a.lastFocusedAt || 0));
    if (target) return eligible.find(tab => chatConversationPath(tab.url) === target) || eligible.find(tab => tab.isNew && !tab.hasDraft) || null;
    return eligible[0] || null;
  }
  async function registeredChatTabs() {
    if (typeof GM_getTabs === 'function') {
      const tabs = await new Promise(resolve => {
        const timer = setTimeout(() => resolve(null), 1500);
        try { GM_getTabs(value => { clearTimeout(timer); resolve(value); }); } catch (_) { clearTimeout(timer); resolve(null); }
      });
      if (tabs) return Object.values(tabs).map(tab => tab?.wishChatGPT).filter(Boolean);
    }
    const recent = gmRead(CHAT_RECENT_TAB_KEY, null);
    return recent && Date.now() - Number(recent.seenAt) < 90000 ? [recent] : [];
  }
  async function openChatGPTAfterTransfer(targetUrl = '') {
    const tab = chooseChatTab(await registeredChatTabs(), targetUrl);
    if (tab) {
      gmWrite(CHAT_FOCUS_KEY, { id:`focus_${Date.now()}_${Math.random()}`, token:tab.token, targetUrl, createdAt:Date.now() });
      notify('열려 있는 ChatGPT 탭으로 이동을 요청했습니다. 모바일에서 전환되지 않으면 해당 탭을 눌러 주세요.', 'info', 6500);
      return true;
    }
    const url = targetUrl ? validChatRoomUrl(targetUrl) : 'https://chatgpt.com/';
    try {
      if (typeof GM_openInTab === 'function') { GM_openInTab(url, { active:true, setParent:true }); return true; }
    } catch (_) {}
    try {
      const popup = window.open(url, '_blank');
      if (popup) { try { popup.opener = null; popup.focus(); } catch (_) {} return true; }
    } catch (_) {}
    notify('브라우저가 ChatGPT 열기를 막았습니다. ChatGPT 탭을 직접 열면 준비한 파일을 받을 수 있습니다.', 'warn', 8000);
    return false;
  }
  // Patch 1.0 transfer path: the Core finishes making its selected TXT/ZIP first,
  // then the last download sheet offers GPT transfer beside Close.
  function transferKindForDialog(dialog) {
    const names = [...dialog.querySelectorAll('a[data-txt-download][download]')].map(a => String(a.download || ''));
    if (names.length && names.every(name => /^Wish-재구축-\d+of\d+\.txt$/i.test(name))) return 'full';
    if (names.length === 1 && /^Wish-rebuild-all-[\d-]+\.zip$/i.test(names[0])) return 'full';
    if (names.length === 1 && /^Wish-자료집-전체RP\+지침-[\d-]+\.txt$/i.test(names[0])) return 'lore';
    return '';
  }
  function mimeForName(name) {
    if (/\.zip$/i.test(name)) return 'application/zip';
    if (/\.json$/i.test(name)) return 'application/json';
    return 'text/plain;charset=utf-8';
  }
  function fileExtension(name) { return String(name || '').match(/(\.[A-Za-z0-9]+)$/)?.[1]?.toLowerCase() || '.txt'; }
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('파일을 임시 보관용으로 읽지 못했습니다.'));
      reader.readAsDataURL(blob);
    });
  }
  function base64ToBytes(value) {
    const raw = atob(String(value || '')), out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function storedFileBlob(item) {
    return item.encoding === 'base64'
      ? new Blob([base64ToBytes(item.data)], { type:item.mime || mimeForName(item.name) })
      : new Blob([String(item.data ?? item.text ?? '')], { type:item.mime || mimeForName(item.name) });
  }
  async function portableFile(blob, sourceName, index) {
    const textLike = /^text\//i.test(blob.type) || /\.(?:txt|json|md)$/i.test(sourceName);
    if (textLike) return { sourceName, name:sourceName, mime:blob.type || mimeForName(sourceName), encoding:'text', data:await blob.text(), bytes:blob.size, index };
    return { sourceName, name:sourceName, mime:blob.type || mimeForName(sourceName), encoding:'base64', data:await blobToBase64(blob), bytes:blob.size, index };
  }
  async function readDownloadAnchor(anchor, index) {
    const response = await fetch(anchor.href);
    if (!response.ok) throw new Error(`파일 준비 확인 실패 (HTTP ${response.status})`);
    return portableFile(await response.blob(), String(anchor.download || `Wish-export-${index + 1}.txt`), index);
  }
  function countTextTurns(value) {
    const text = String(value || '').replace(/\r\n/g, '\n');
    const matches = [...text.matchAll(/^\[완료 RP \d+\]\[USER\]\n/gm)];
    let count = 0;
    for (const match of matches) {
      const end = text.indexOf('\n\n[ASSISTANT]\n', match.index + match[0].length);
      if (end < 0) continue;
      const user = text.slice(match.index + match[0].length, end).trim();
      if (user || count) count++;
    }
    return count;
  }
  function transferPrompt(kind, roomName, endTurn, files, corePrompt = '') {
    const start = endTurn > 0 ? 1 : 0;
    const label = kind === 'secondary' ? '외부 AI 2차 재구축' : kind === 'lore' ? '외부 AI 자료집 재구축' : '외부 AI 전체 재구축';
    const lines = [CHAT_TRANSFER_MESSAGE, `스토리챗 이름: ${roomName}`, `작업: ${label}`, `첨부 파일 턴 범위: T${start}-T${endTurn}`, `최종 결과에 반영된 턴 범위를 T${start}-T${endTurn}으로 명시해줘.`];
    if (kind === 'secondary') lines.push('첨부 파일은 현재 저장 자료의 2차 재구축용이다. 실제 자료에 없는 턴의 반영을 완료했다고 주장하지 말고 파일 안의 원래 지침을 실행해줘.');
    else lines.push('인트로는 T0으로 취급하고 확정 RP 턴수에 더하지 마. 파일 안의 원래 지침과 출력 스키마를 그대로 지켜줘.');
    if (corePrompt.trim()) lines.push(corePrompt.trim());
    const base = safeFilenamePart(roomName), suffix = kind === 'secondary' ? '_2차재구축' : kind === 'lore' ? '_자료집재구축' : '';
    lines.push(`최종 결과 파일명은 ${base}_T${start}-T${endTurn}${suffix}.json 으로 해줘.`);
    if (files.length > 1) lines.push('첨부 파일은 파일명에 표시된 턴 순서대로 모두 읽어줘.');
    return lines.join('\n');
  }
  async function prepareTransfer(kind, files, corePrompt = '') {
    const roomName = currentRoomDisplayName(), base = safeFilenamePart(roomName);
    let endTurn = 0, cursor = 1;
    const textCounts = files.map(file => file.encoding === 'text' ? countTextTurns(file.data) : 0);
    if (textCounts.some(Boolean)) endTurn = textCounts.reduce((sum, count) => sum + count, 0);
    if (!endTurn) endTurn = await currentCompletedTurnCount().catch(() => visibleCompletedTurnCount());
    endTurn = Math.max(0, Number(endTurn) || 0);
    for (let i = 0; i < files.length; i++) {
      const count = textCounts[i], start = endTurn ? (count ? cursor : 1) : 0, end = count ? cursor + count - 1 : endTurn;
      const ext = fileExtension(files[i].sourceName);
      files[i].turnStart = start; files[i].turnEnd = end;
      files[i].name = `${base}_T${start}-T${end}${files.length > 1 ? `_${i + 1}of${files.length}` : ''}${ext}`;
      if (count) cursor = end + 1;
    }
    const zipStartPrompt = files.length === 1 && /\.zip$/i.test(files[0].sourceName || files[0].name || '') && String(corePrompt || '').trim();
    const transfer = { id:`wish_gpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, kind, chatId:currentApiChatId(), roomName, startTurn:endTurn ? 1 : 0, endTurn,
      createdAt:Date.now(), updatedAt:Date.now(), expiresAt:Date.now() + CHAT_TRANSFER_TTL, ready:true, files,
      message:zipStartPrompt || transferPrompt(kind, roomName, endTurn, files, corePrompt) };
    if (!gmWrite(CHAT_TRANSFER_KEY, transfer)) throw new Error('템퍼몽키 임시 저장소에 파일을 기록하지 못했습니다.');
    chatTransferCache = transfer;
    return transfer;
  }
  async function prepareTransferFromDialog(dialog, kind) {
    const links = [...dialog.querySelectorAll('a[data-txt-download][download]')];
    if (!links.length) throw new Error('전송할 TXT/ZIP 파일을 찾지 못했습니다.');
    const files = await Promise.all(links.map((link, index) => readDownloadAnchor(link, index)));
    const corePrompt = dialog.querySelector('textarea[aria-label="시작 문구"]')?.value || '';
    return prepareTransfer(kind, files, corePrompt);
  }
  function downloadStoredFiles(files) {
    for (const item of files) {
      const url = URL.createObjectURL(storedFileBlob(item)), anchor = document.createElement('a');
      anchor.href = url; anchor.download = item.name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }
  async function sendPreparedTransfer(transfer) {
    notify(`ChatGPT 전송 준비 완료 · ${transfer.roomName} · T${transfer.startTurn}-T${transfer.endTurn}`, 'success', 6500);
    await openChatGPTAfterTransfer();
  }
  function injectFinalGptButton(dialog) {
    const kind = transferKindForDialog(dialog), footer = dialog.querySelector('.m3-sheet>footer');
    if (!kind || !footer || footer.querySelector('[data-wish-gpt-final]')) return;
    const close = footer.querySelector('[data-act="closeDlg"]');
    if (!close) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'm3-btn wish-gpt-prepare-button'; button.dataset.wishGptFinal = kind;
    button.setAttribute('data-fx-node', ''); button.textContent = 'GPT 전송';
    button.onclick = async event => {
      event.preventDefault(); event.stopPropagation(); if (button.disabled) return;
      button.disabled = true; const old = button.textContent; button.textContent = '준비 중…';
      try { await sendPreparedTransfer(await prepareTransferFromDialog(dialog, kind)); }
      catch (error) { notify(`ChatGPT 전송 준비 실패: ${error.message}`, 'error', 8500); button.disabled = false; button.textContent = old; }
    };
    close.insertAdjacentElement('beforebegin', button);
  }
  async function showSecondaryTransferModal(file) {
    const transfer = await prepareTransfer('secondary', [file]);
    const modal = createModal('2차 재구축 파일 준비 완료', `${transfer.roomName} · T${transfer.startTurn}-T${transfer.endTurn}`);
    modal.body.innerHTML = `<div class="wish-fbp-note">파일을 내려받거나 ChatGPT로 바로 보낼 수 있습니다.</div><div class="wish-transfer-file"><b>${esc(transfer.files[0].name)}</b><small>${Math.ceil(transfer.files[0].bytes / 1024).toLocaleString('ko-KR')} KB</small></div>`;
    modal.footer.innerHTML = '<button type="button" data-secondary-download>TXT 다운로드</button><span></span><button type="button" data-secondary-close>닫기</button><button type="button" class="primary" data-secondary-gpt>GPT 전송</button>';
    modal.footer.querySelector('[data-secondary-close]').onclick = modal.close;
    modal.footer.querySelector('[data-secondary-download]').onclick = () => downloadStoredFiles(transfer.files);
    modal.footer.querySelector('[data-secondary-gpt]').onclick = async event => { event.currentTarget.disabled = true; try { await sendPreparedTransfer(transfer); } catch (error) { notify(`ChatGPT 탭 이동 실패: ${error.message}`, 'error'); event.currentTarget.disabled = false; } };
  }
  function installSecondaryDownloadCapture() {
    document.addEventListener('click', event => {
      const run = event.target.closest?.('[data-act="secondaryExportRun"]');
      if (run && !run.disabled) { secondaryCaptureRequestedAt = Date.now(); return; }
      const anchor = event.target.closest?.('a[download]');
      if (!anchor || !/^Wish-2차재구축-전체\.txt$/i.test(anchor.download || '') || Date.now() - secondaryCaptureRequestedAt > 120000) return;
      event.preventDefault(); event.stopImmediatePropagation(); secondaryCaptureRequestedAt = 0;
      void readDownloadAnchor(anchor, 0).then(showSecondaryTransferModal).catch(error => notify(`2차 재구축 파일 준비 실패: ${error.message}`, 'error', 8500));
    }, true);
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function findChatGPTFileInput() {
    const inputs = [...document.querySelectorAll('input[type="file"]')].filter(input => !input.disabled);
    return inputs.find(input => {
      const accept = String(input.accept || '').toLowerCase();
      return !accept || accept.includes('text') || accept.includes('.txt') || accept.includes('application');
    }) || null;
  }
  async function getChatGPTFileInput() {
    let input = findChatGPTFileInput();
    if (input) return input;
    const plus = document.querySelector('button[data-testid="composer-plus-btn"],button[aria-label*="파일 첨부"],button[aria-label*="파일 추가"],button[aria-label*="Add files"],button[aria-label*="Attach"]');
    if (plus && !plus.disabled) {
      plus.click();
      for (let attempt = 0; attempt < 8 && !input; attempt++) { await wait(150); input = findChatGPTFileInput(); }
    }
    return input;
  }
  function findChatGPTComposer() {
    return document.querySelector('#prompt-textarea,textarea[data-testid="prompt-textarea"],form textarea,div[contenteditable="true"][data-lexical-editor="true"],main div[contenteditable="true"]');
  }
  function composerText() {
    const element = findChatGPTComposer();
    return String(element && ('value' in element ? element.value : element.innerText || element.textContent) || '').trim();
  }
  function isNewChatPage() {
    return !chatConversationPath(location.href) && /^\/(?:g\/[^/]+\/?)?$/.test(location.pathname) &&
      !new URL(location.href).searchParams.has('temporary-chat') && !document.querySelector('[data-message-author-role="user"]');
  }
  function publishChatTab() {
    if (!chatTabToken) return;
    const value = { token:chatTabToken, url:location.origin + location.pathname, seenAt:Date.now(), lastFocusedAt:chatLastFocusedAt,
      isNew:isNewChatPage(), hasDraft:!!composerText() || !!document.querySelector('[data-testid*="attachment"],[data-testid*="file-preview"]') };
    if (chatTabData && typeof GM_saveTab === 'function') {
      chatTabData.wishChatGPT = value;
      try { GM_saveTab(chatTabData); } catch (_) {}
    }
    if (document.visibilityState === 'visible') gmWrite(CHAT_RECENT_TAB_KEY, value);
  }
  function receiveChatFocus() {
    const command = gmRead(CHAT_FOCUS_KEY, null);
    if (!command || command.token !== chatTabToken || command.id === lastFocusRequestId || Date.now() - Number(command.createdAt) > 120000) return;
    lastFocusRequestId = command.id;
    try { window.focus(); } catch (_) {}
    const target = chatConversationPath(command.targetUrl);
    if (target && target !== chatConversationPath(location.href)) {
      // Only an empty new page may be navigated to the requested existing conversation.
      if (isNewChatPage() && !composerText() && !document.querySelector('[data-testid*="attachment"],[data-testid*="file-preview"]')) location.assign(validChatRoomUrl(command.targetUrl));
      else notify('이어서 보낼 대화 주소가 다릅니다. 전달함의 파일을 첨부하기 전에 해당 대화로 이동해 주세요.', 'warn', 8000);
    }
  }
  async function registerChatTab() {
    if (typeof GM_getTab === 'function' && typeof GM_saveTab === 'function') {
      chatTabData = await new Promise(resolve => {
        const timer = setTimeout(() => resolve(null), 1500);
        try { GM_getTab(value => { clearTimeout(timer); resolve(value || {}); }); } catch (_) { clearTimeout(timer); resolve(null); }
      });
    }
    chatTabToken = chatTabData?.wishChatGPT?.token || `wish_tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    publishChatTab();
    if (typeof GM_addValueChangeListener === 'function') GM_addValueChangeListener(CHAT_FOCUS_KEY, receiveChatFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') chatLastFocusedAt = Date.now();
      publishChatTab(); receiveChatFocus();
    });
    window.addEventListener('focus', () => { chatLastFocusedAt = Date.now(); publishChatTab(); });
    setInterval(() => { publishChatTab(); receiveChatFocus(); }, 5000);
    receiveChatFocus();
  }
  function savePendingTitle(value) {
    pendingChatTitle = value;
    try { if (value) sessionStorage.setItem(CHAT_TITLE_PENDING_KEY, JSON.stringify(value)); else sessionStorage.removeItem(CHAT_TITLE_PENDING_KEY); } catch (_) {}
  }
  function normalizedText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function findConversationLink(path) {
    return [...document.querySelectorAll('nav a[href],aside a[href],[role="navigation"] a[href],a[data-testid^="history-item"],[data-testid="sidebar"] a[href]')].find(link => chatConversationPath(link.href) === path) || null;
  }
  function titleMatches(link, title) {
    if (!link) return false;
    const wanted = normalizedText(title);
    return [link.getAttribute('title'), link.getAttribute('aria-label'), link.textContent,
      ...[...link.querySelectorAll('span,[dir="auto"],.truncate')].map(node => node.textContent)].some(value => normalizedText(value) === wanted);
  }
  async function waitForElement(read, timeout = 3500) {
    const until = Date.now() + timeout;
    do { const found = read(); if (found) return found; await wait(150); } while (Date.now() < until);
    return null;
  }
  function armChatTitleOnSend(event) {
    const pending = pendingChatTitle;
    if (!pending || pending.path || Date.now() - pending.createdAt > CHAT_TRANSFER_TTL || !isNewChatPage() || !normalizedText(composerText()).includes(pending.signature)) return;
    if (event.type === 'keydown') {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      const composer = findChatGPTComposer();
      if (!composer || (event.target !== composer && !composer.contains(event.target))) return;
    } else {
      const button = event.target.closest?.('button');
      if (!button || button.disabled || !(button.getAttribute('data-testid') === 'send-button' || /^(?:send(?: message| prompt)?|보내기|전송|메시지 보내기|프롬프트 보내기)$/i.test(button.getAttribute('aria-label') || ''))) return;
    }
    savePendingTitle({ ...pending, submittedAt:Date.now() });
  }
  function bindNewConversationTitle() {
    const pending = pendingChatTitle;
    if (!pending || pending.path || !pending.submittedAt || Date.now() - pending.submittedAt > 5 * 60 * 1000) return;
    const path = chatConversationPath(location.href);
    const messages = [...document.querySelectorAll('[data-message-author-role="user"]')];
    if (!path || messages.length !== 1 || !normalizedText(messages[0].textContent).includes(pending.signature)) return;
    savePendingTitle({ ...pending, path, boundAt:Date.now(), status:'pending' });
  }
  async function applyNewConversationTitle(manual = false) {
    const pending = pendingChatTitle;
    if (!pending || !pending.path || pending.status === 'done' || Date.now() - pending.createdAt > CHAT_TRANSFER_TTL || titleRenameBusy ||
        chatConversationPath(location.href) !== pending.path || document.visibilityState !== 'visible') return;
    if (!manual && (Date.now() < titleRetryAfter || pending.attempted)) return;
    if (!manual && (Date.now() - Number(pending.boundAt || 0) < 8000 || !document.querySelector('[data-message-author-role="assistant"]'))) return;
    if (document.querySelector('[data-testid="stop-button"],button[aria-label="Stop streaming"],button[aria-label="응답 중지"],[role="menu"],[role="dialog"]')) return;
    if (!manual && composerText()) return;
    titleRenameBusy = true;
    titleRetryAfter = Date.now() + 15000;
    let sidebarOpened = false;
    try {
      let link = findConversationLink(pending.path);
      if (!link) {
        const toggle = document.querySelector('[data-testid="open-sidebar-button"],button[aria-label="Open sidebar"],button[aria-label="사이드바 열기"]');
        if (toggle) { toggle.click(); sidebarOpened = true; link = await waitForElement(() => findConversationLink(pending.path)); }
      }
      if (!link) throw new Error('대화 목록을 열고 “대화 이름 적용”을 눌러 주세요.');
      if (!titleMatches(link, pending.roomName)) {
        const rows = [link.closest('li,[data-testid^="history-item"],[data-sidebar-item]'), link, link.parentElement].filter(Boolean);
        const row = rows.find(node => node.querySelector('button[aria-haspopup="menu"],button[data-testid$="-options"]'));
        const options = row?.querySelector('button[aria-haspopup="menu"],button[data-testid$="-options"]');
        if (!options) throw new Error('이 대화의 이름 변경 메뉴를 찾지 못했습니다.');
        options.click();
        const rename = await waitForElement(() => [...document.querySelectorAll('[role="menuitem"]')].find(item => /^(?:rename|이름 바꾸기|이름 변경)$/i.test(item.textContent.trim())));
        if (!rename) throw new Error('이름 변경 메뉴를 찾지 못했습니다.');
        rename.click();
        const input = await waitForElement(() => document.querySelector('[role="dialog"] input:not([type="hidden"]):not([type="search"])') || row.querySelector('input:not([type="hidden"])'));
        if (!input) throw new Error('대화 이름 입력칸을 찾지 못했습니다.');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, pending.roomName); else input.value = pending.roomName;
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
        const dialog = input.closest('[role="dialog"]');
        const save = dialog && [...dialog.querySelectorAll('button')].find(button => /^(?:save|저장|확인)$/i.test(button.textContent.trim()) && !button.disabled);
        if (save) save.click();
        else { input.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', code:'Enter', bubbles:true })); input.dispatchEvent(new KeyboardEvent('keyup', { key:'Enter', code:'Enter', bubbles:true })); }
        const verified = await waitForElement(() => titleMatches(findConversationLink(pending.path), pending.roomName), 4500);
        if (!verified) throw new Error('대화 이름 저장을 확인하지 못했습니다. 목록에서 이름을 확인해 주세요.');
      }
      savePendingTitle({ ...pending, attempted:true, status:'done' });
      notify(`새 ChatGPT 대화 이름을 “${pending.roomName}”으로 적용했습니다.`, 'success');
      if (sidebarOpened) document.querySelector('[data-testid="close-sidebar-button"],button[aria-label="Close sidebar"],button[aria-label="사이드바 닫기"]')?.click();
    } catch (error) {
      savePendingTitle({ ...pending, attempted:true, status:'retry', error:error.message });
      notify(`대화 이름: ${error.message}`, 'warn', 8000);
    } finally { titleRenameBusy = false; renderChatGPTBridge(); }
  }
  function putChatGPTMessage(element, message) {
    if (!element) throw new Error('ChatGPT 메시지 입력창을 찾지 못했습니다.');
    const current = String('value' in element ? element.value : element.innerText || element.textContent || '').trim();
    if (current.includes(message)) return;
    const addition = `${current ? '\n\n' : ''}${message}`;
    element.focus();
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(element, `${current}${addition}`); else element.value = `${current}${addition}`;
      element.dispatchEvent(new Event('input', { bubbles:true }));
      element.dispatchEvent(new Event('change', { bubbles:true }));
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    const inserted = document.execCommand?.('insertText', false, addition);
    if (!inserted) element.textContent = `${current}${addition}`;
    element.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:addition }));
  }
  async function attachTransferToChat(transfer) {
    if (typeof DataTransfer !== 'function') throw new Error('이 브라우저는 자동 파일 첨부를 지원하지 않습니다. TXT 저장 버튼을 사용해 주세요.');
    const newConversation = isNewChatPage();
    const message = transfer.message || transferMessage(transfer);
    let input = await getChatGPTFileInput();
    if (!input) throw new Error('파일 입력기를 찾지 못했습니다. 입력창의 + 버튼을 한 번 연 뒤 다시 시도해 주세요.');
    const assign = (target, items) => {
      const data = new DataTransfer();
      for (const item of items) data.items.add(new File([storedFileBlob(item)], String(item.name || 'Wish-재구축.txt'), { type:item.mime || mimeForName(item.name), lastModified:Number(transfer.updatedAt || Date.now()) }));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
      if (setter) setter.call(target, data.files); else target.files = data.files;
      if (target.files?.length !== items.length) throw new Error('브라우저가 파일 자동 첨부를 허용하지 않았습니다. 전달함의 저장 버튼으로 파일을 받아 첨부해 주세요.');
      target.dispatchEvent(new Event('input', { bubbles:true }));
      target.dispatchEvent(new Event('change', { bubbles:true }));
    };
    if (input.multiple || transfer.files.length === 1) assign(input, transfer.files);
    else {
      for (const item of transfer.files) {
        input = await getChatGPTFileInput();
        if (!input) throw new Error(`${item.name}을 첨부할 파일 입력기를 찾지 못했습니다.`);
        assign(input, [item]);
        await wait(350);
      }
    }
    await wait(650);
    putChatGPTMessage(findChatGPTComposer(), message);
    if (newConversation) savePendingTitle({ transferId:transfer.id, chatId:transfer.chatId, roomName:transfer.roomName,
      signature:normalizedText(message), createdAt:Date.now(), submittedAt:0, path:'', status:'waiting' });
    // "이 방으로 전송"이 파일 첨부와 문구 입력을 마친 순간 임시 원본을 삭제한다.
    gmWrite(CHAT_TRANSFER_KEY, null);
    chatTransferCache = null;
  }
  function downloadTransferFiles(transfer) {
    downloadStoredFiles(transfer.files);
    notify(`전달 파일 ${transfer.files.length}개 저장 요청 완료`, 'success');
  }
  function renderChatGPTBridge() {
    if (!document.body) return;
    const transfer = validTransfer(chatTransferCache === undefined ? (chatTransferCache = gmRead(CHAT_TRANSFER_KEY, null)) : chatTransferCache);
    let widget = document.getElementById('wish-gpt-transfer-widget');
    if (!transfer) { chatTransferCache = null; widget?.remove(); return; }
    if (chatAttachBusy && widget) return;
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'wish-gpt-transfer-widget';
      document.body.appendChild(widget);
    }
    bindNewConversationTitle();
    const titleForThis = pendingChatTitle?.transferId === transfer.id ? pendingChatTitle : null;
    const kind = transfer.kind === 'secondary' ? '2차 재구축' : transfer.kind === 'lore' ? '자료집 재구축' : '전체 재구축';
    const signature = `${transfer.id}:${transfer.updatedAt}:${location.pathname}:${titleForThis?.status || ''}`;
    if (widget.dataset.renderSignature === signature) return;
    widget.dataset.renderSignature = signature;
    widget.innerHTML = `<button type="button" class="wish-gpt-send"><b>🪽 이 방으로 전송</b><small>${kind} · T${transfer.startTurn}-T${transfer.endTurn} · 파일 ${transfer.files.length}개</small></button><button type="button" class="wish-gpt-save" title="자동 첨부가 안 될 때 파일 저장">저장</button><button type="button" class="wish-gpt-clear" title="임시 전달 파일 지우기">×</button>`;
    widget.querySelector('.wish-gpt-send').onclick = async event => {
      if (chatAttachBusy) return;
      chatAttachBusy = true;
      const button = event.currentTarget;
      button.disabled = true;
      const before = button.innerHTML;
      button.innerHTML = '<b>첨부하는 중…</b><small>잠시 기다려 주세요</small>';
      try {
        await attachTransferToChat(transfer);
        notify('파일과 요청 문구를 입력했습니다. ChatGPT 전송 버튼을 직접 눌러 주세요.', 'success', 7500);
      } catch (error) {
        notify(`ChatGPT 첨부 실패: ${error.message}`, 'error', 8500);
        button.innerHTML = before;
      } finally { chatAttachBusy = false; if (button.isConnected) button.disabled = false; if (widget.isConnected) widget.dataset.renderSignature = ''; renderChatGPTBridge(); }
    };
    if (titleForThis?.path && titleForThis.path === chatConversationPath(location.href) && titleForThis.status !== 'done') {
      const titleButton = document.createElement('button');
      titleButton.type = 'button';
      titleButton.className = 'wish-gpt-title';
      titleButton.textContent = titleRenameBusy ? '대화 이름 적용 중…' : '대화 이름 적용';
      titleButton.title = titleForThis.roomName;
      titleButton.disabled = titleRenameBusy;
      titleButton.onclick = () => { void applyNewConversationTitle(true); };
      widget.appendChild(titleButton);
    }
    widget.querySelector('.wish-gpt-save').onclick = () => downloadTransferFiles(transfer);
    widget.querySelector('.wish-gpt-clear').onclick = () => {
      if (!confirm('ChatGPT 전달함의 임시 TXT를 지울까요? 원래 다운로드 파일과 RP Manager 자료는 지워지지 않습니다.')) return;
      gmWrite(CHAT_TRANSFER_KEY, null);
      chatTransferCache = null;
      widget.remove();
      notify('ChatGPT 임시 전달 파일을 지웠습니다.', 'success');
    };
  }
  function installChatGPTBridge() {
    const start = async () => {
      await registerChatTab();
      document.body?.classList.add('wish-gpt-bridge-page');
      document.addEventListener('click', armChatTitleOnSend, true);
      document.addEventListener('keydown', armChatTitleOnSend, true);
      chatTransferCache = gmRead(CHAT_TRANSFER_KEY, null);
      renderChatGPTBridge();
      if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener(CHAT_TRANSFER_KEY, (_key, _oldValue, newValue) => {
          try { chatTransferCache = typeof newValue === 'string' ? JSON.parse(newValue) : newValue; }
          catch (_) { chatTransferCache = gmRead(CHAT_TRANSFER_KEY, null); }
          renderChatGPTBridge();
        });
      }
      setInterval(() => { chatTransferCache = gmRead(CHAT_TRANSFER_KEY, null); renderChatGPTBridge(); }, 5000);
      setInterval(() => { renderChatGPTBridge(); bindNewConversationTitle(); void applyNewConversationTitle(); }, 2500);
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once:true });
  }

  function notify(message, type = 'info', duration = 4300) {
    let wrap = document.getElementById('wish-fbp-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'wish-fbp-toast-wrap';
      document.documentElement.appendChild(wrap);
    }
    const toast = document.createElement('div');
    toast.className = `wish-fbp-toast ${type}`;
    toast.textContent = String(message || '');
    wrap.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 220); }, duration);
  }

  function normalizeDatabaseURL(value) { return String(value || '').trim().replace(/\/+$/, ''); }
  function loadSettings() {
    const saved = gmRead(SETTINGS_KEY, {}) || {};
    return {
      apiKey: String(saved.apiKey || DEFAULTS.apiKey).trim(),
      databaseURL: normalizeDatabaseURL(saved.databaseURL || DEFAULTS.databaseURL),
      email: String(saved.email || DEFAULTS.email).trim(),
    };
  }
  function validateSettings(settings) {
    if (!settings?.apiKey || !settings?.databaseURL || !settings?.email) throw new Error('Web API Key, Database URL, 로그인 이메일을 모두 입력해 주세요.');
    let url;
    try { url = new URL(settings.databaseURL); }
    catch (_) { throw new Error('Realtime Database URL 형식이 올바르지 않습니다.'); }
    if (url.protocol !== 'https:' || !/(^|\.)(firebaseio\.com|firebasedatabase\.app)$/i.test(url.hostname)) throw new Error('Firebase Realtime Database HTTPS 주소를 입력해 주세요.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) throw new Error('Firebase 로그인 이메일 형식이 올바르지 않습니다.');
    return settings;
  }
  function saveSettings(settings) {
    const next = validateSettings({
      apiKey: String(settings?.apiKey || '').trim(),
      databaseURL: normalizeDatabaseURL(settings?.databaseURL),
      email: String(settings?.email || '').trim(),
    });
    gmWrite(SETTINGS_KEY, next);
    return next;
  }
  function sessionMatches(session, settings) {
    return !!session && String(session.apiKey || '') === settings.apiKey && normalizeDatabaseURL(session.databaseURL) === settings.databaseURL && String(session.email || '').toLowerCase() === settings.email.toLowerCase();
  }
  function connected(settings = loadSettings()) {
    const session = gmRead(SESSION_KEY, null);
    return sessionMatches(session, settings) && !!session?.refreshToken;
  }
  function clearSession() { gmWrite(SESSION_KEY, null); }

  function firebaseError(text, status, fallback) {
    let parsed = null;
    try { parsed = JSON.parse(String(text || '')); } catch (_) {}
    const raw = String(parsed?.error?.message || parsed?.error || parsed?.message || '').trim();
    const code = raw.toUpperCase().replace(/[\s-]+/g, '_');
    const labels = {
      INVALID_LOGIN_CREDENTIALS:'이메일 또는 비밀번호가 올바르지 않습니다.',
      EMAIL_NOT_FOUND:'등록되지 않은 Firebase 사용자입니다.',
      INVALID_PASSWORD:'비밀번호가 올바르지 않습니다.',
      USER_DISABLED:'비활성화된 Firebase 사용자입니다.',
      OPERATION_NOT_ALLOWED:'Firebase Authentication에서 이메일/비밀번호 로그인을 활성화해 주세요.',
      PERMISSION_DENIED:'Realtime Database 보안 규칙이 이 계정의 접근을 허용하지 않습니다.',
      TOKEN_EXPIRED:'Firebase 로그인 세션이 만료되었습니다.',
    };
    if (labels[code]) return labels[code];
    if (/permission.?denied/i.test(raw)) return labels.PERMISSION_DENIED;
    return raw ? `${fallback} (${raw})` : `${fallback}${status ? ` (HTTP ${status})` : ''}`;
  }
  function http({ method = 'GET', url, headers = {}, data, timeout = 120000, label = 'Firebase 요청' }) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method, url, headers, data, timeout,
      onload: response => {
        const text = String(response.responseText || '');
        if (!(response.status >= 200 && response.status < 300)) {
          const error = new Error(firebaseError(text, response.status, `${label} 실패`));
          error.status = Number(response.status || 0);
          reject(error);
          return;
        }
        let parsed = null;
        if (text.trim()) {
          try { parsed = JSON.parse(text); }
          catch (_) { reject(new Error(`${label} 응답 JSON을 읽지 못했습니다.`)); return; }
        }
        resolve(parsed);
      },
      ontimeout: () => reject(new Error(`${label} 시간이 초과되었습니다.`)),
      onerror: () => reject(new Error(`${label} 네트워크 연결에 실패했습니다.`)),
    }));
  }
  async function signIn(settings, password) {
    validateSettings(settings);
    if (!password) throw new Error('Firebase 계정 비밀번호를 입력해 주세요.');
    const data = await http({
      method:'POST',
      url:`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(settings.apiKey)}`,
      headers:{ 'Content-Type':'application/json' },
      data:JSON.stringify({ email:settings.email, password:String(password), returnSecureToken:true }),
      timeout:30000,
      label:'Firebase 로그인',
    });
    const session = {
      apiKey:settings.apiKey,
      databaseURL:settings.databaseURL,
      email:settings.email,
      idToken:String(data?.idToken || ''),
      refreshToken:String(data?.refreshToken || ''),
      localId:String(data?.localId || ''),
      expiresAt:Date.now() + Math.max(60, Number(data?.expiresIn) || 3600) * 1000,
    };
    if (!session.idToken || !session.refreshToken || !session.localId) throw new Error('Firebase 로그인 토큰이 응답에 없습니다.');
    gmWrite(SESSION_KEY, session);
    return session;
  }
  async function refreshSession(settings, session) {
    if (!sessionMatches(session, settings) || !session?.refreshToken) throw new Error('Firebase 로그인이 필요합니다.');
    const data = await http({
      method:'POST',
      url:`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(settings.apiKey)}`,
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      data:`grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
      timeout:30000,
      label:'Firebase 로그인 갱신',
    });
    const next = {
      ...session,
      idToken:String(data?.id_token || ''),
      refreshToken:String(data?.refresh_token || session.refreshToken),
      localId:String(data?.user_id || session.localId),
      expiresAt:Date.now() + Math.max(60, Number(data?.expires_in) || 3600) * 1000,
    };
    if (!next.idToken) throw new Error('Firebase 갱신 토큰 응답이 비어 있습니다.');
    gmWrite(SESSION_KEY, next);
    return next;
  }
  async function getSession(settings, forceRefresh = false) {
    const session = gmRead(SESSION_KEY, null);
    if (!sessionMatches(session, settings)) return null;
    if (!forceRefresh && session.idToken && Number(session.expiresAt || 0) > Date.now() + 90000) return session;
    try { return await refreshSession(settings, session); }
    catch (_) { clearSession(); return null; }
  }
  async function databaseRequest(settings, method, path, body, retry = true) {
    let session = await getSession(settings);
    if (!session) throw new Error('Firebase 로그인이 필요합니다. 클라우드 백업에서 Firebase를 선택하고 연결해 주세요.');
    const safePath = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const silent = String(method).toUpperCase() === 'GET' ? '' : '&print=silent';
    try {
      return await http({
        method,
        url:`${settings.databaseURL}/${safePath}.json?auth=${encodeURIComponent(session.idToken)}${silent}`,
        headers:{ 'Content-Type':'application/json' },
        data:body === undefined ? undefined : JSON.stringify(body),
        timeout:120000,
        label:'Firebase Database',
      });
    } catch (error) {
      if (retry && [401, 403].includes(Number(error.status))) {
        session = await getSession(settings, true);
        if (session) return databaseRequest(settings, method, path, body, false);
      }
      throw error;
    }
  }
  async function ensureReady() {
    const settings = loadSettings();
    validateSettings(settings);
    const session = await getSession(settings);
    if (!session) {
      throw new Error('클라우드 백업에서 Firebase를 선택한 뒤 비밀번호를 입력하고 연결해 주세요.');
    }
    return { settings, session };
  }

  function openWishDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onupgradeneeded = () => {
        try { request.transaction.abort(); } catch (_) {}
        reject(new Error('Wish RP Manager Core 저장소가 아직 만들어지지 않았습니다. 원본 확장을 먼저 한 번 열어 주세요.'));
      };
      request.onsuccess = () => {
        const db = request.result;
        const missing = STORES.filter(name => !db.objectStoreNames.contains(name));
        if (missing.length) { db.close(); reject(new Error(`Wish 저장소가 준비되지 않았습니다: ${missing.join(', ')}`)); return; }
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('Wish 저장소를 열지 못했습니다.'));
      request.onblocked = () => reject(new Error('Wish 저장소가 다른 작업에 사용 중입니다. 잠시 후 다시 시도해 주세요.'));
    });
  }
  function readAllStores(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, 'readonly');
      const output = {};
      for (const name of STORES) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { output[name] = request.result || []; };
      }
      tx.oncomplete = () => resolve(output);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Wish 백업 데이터를 읽지 못했습니다.'));
    });
  }
  function isCoreRuntime(record) {
    return record?.kind !== 'native-summary-plan' && !String(record?.id || '').startsWith('wish-native-summary-plan-v1:');
  }
  function sanitizeBackup(input, depth = 0, budget = { left:10000 }, seen = new WeakSet()) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('백업 묶음 형식이 올바르지 않습니다.');
    if (depth > 16 || --budget.left < 0 || seen.has(input)) throw new Error('백업 이력의 중첩 구조가 너무 깊거나 반복됩니다.');
    seen.add(input);
    try {
      const output = { ...input };
      for (const key of ['nativeMemoryRooms','injectionSessions','_wishRpCloudSnapshot','cloudSchema','backupKind','aiSettings','uiPrefs','priorityRestore']) delete output[key];
      if (output.format === 'wish-rp-cloud-snapshot') delete output.format;
      if (Array.isArray(output.rooms)) output.rooms = output.rooms.map(item => {
        if (!item || typeof item !== 'object') return item;
        const room = { ...item };
        delete room.lastVerifiedInjectionAt;
        if (room.pending && typeof room.pending === 'object') { room.pending = { ...room.pending }; delete room.pending.cloudRestoredAt; }
        return room;
      });
      if (Array.isArray(output.runtime)) output.runtime = output.runtime.filter(item => item?.kind !== 'wish-lease' && isCoreRuntime(item));
      if (Array.isArray(output.autoHistory)) output.autoHistory = output.autoHistory.map(item => item?.backup ? { ...item, backup:sanitizeBackup(item.backup, depth + 1, budget, seen) } : item);
      return output;
    } finally { seen.delete(input); }
  }
  function readGlobalSettingsBackup() {
    const guides = {};
    for (const [id, key] of Object.entries(GUIDE_STORAGE_KEYS)) {
      const raw = localStorage.getItem(key);
      if (raw == null) { guides[id] = { format:'wish-rp-guide', isCustom:false, baseVersion:GUIDE_BASE_VERSION, text:'' }; continue; }
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (_) {}
      guides[id] = parsed && parsed.format === 'wish-rp-guide' && typeof parsed.text === 'string'
        ? { format:'wish-rp-guide', isCustom:true, baseVersion:String(parsed.baseVersion || 'legacy'), text:parsed.text }
        : { format:'wish-rp-guide', isCustom:true, baseVersion:'legacy', text:String(raw || '') };
    }
    let defaultExtraPreset = {};
    try { defaultExtraPreset = JSON.parse(localStorage.getItem(DEFAULT_EXTRA_PRESET_KEY) || '{}'); } catch (_) {}
    return { guides, defaultExtraPreset };
  }
  async function restoreGlobalSettings(data) {
    for (const [id, key] of Object.entries(GUIDE_STORAGE_KEYS)) {
      const value = data.guides?.[id];
      if (value == null) continue;
      if (value && typeof value === 'object' && value.format === 'wish-rp-guide') {
        if (value.isCustom === false) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify({ format:'wish-rp-guide', baseVersion:String(value.baseVersion || 'legacy-backup'), text:String(value.text || '') }));
      } else if (typeof value === 'string') localStorage.setItem(key, JSON.stringify({ format:'wish-rp-guide', baseVersion:'legacy-backup', text:value }));
    }
    if (data.defaultExtraPreset != null) localStorage.setItem(DEFAULT_EXTRA_PRESET_KEY, JSON.stringify(data.defaultExtraPreset));
    if (data.cognitionSettings) {
      await bridge()?.validateSettings?.(data.cognitionSettings);
      await bridge()?.saveSettings?.(data.cognitionSettings);
    }
  }
  async function createCoreBackup() {
    const db = await openWishDatabase();
    try {
      const data = await readAllStores(db);
      const cognitionSettings = await Promise.resolve(bridge()?.getSettings?.()).catch(() => null);
      const globalSettings = readGlobalSettingsBackup();
      return sanitizeBackup({
        _wishRpManagerBackup:true,
        backupSchema:3,
        version:coreVersion() || '1.5.3',
        firebasePatchVersion:PATCH_VERSION,
        exportedAt:new Date().toISOString(),
        rooms:data.rooms,
        characterLibraries:data.characterLibraries,
        cognitionRooms:data.cognitionRooms,
        runtime:data.runtime.filter(item => item?.kind !== 'wish-lease'),
        autoHistory:data.autoHistory,
        guides:globalSettings.guides,
        defaultExtraPreset:globalSettings.defaultExtraPreset,
        cognitionSettings:cognitionSettings || null,
      });
    } finally { db.close(); }
  }
  function validateCoreBackup(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data._wishRpManagerBackup !== true) throw new Error('Wish RP Manager Core 백업 데이터가 아닙니다.');
    const schema = Number(data.backupSchema ?? 1);
    if (!Number.isInteger(schema) || schema < 1 || schema > 3) throw new Error(`지원하지 않는 백업 schema입니다: ${data.backupSchema}`);
    for (const key of ['rooms','characterLibraries']) if (!Array.isArray(data[key])) throw new Error(`백업의 ${key} 배열이 올바르지 않습니다.`);
    for (const key of ['cognitionRooms','runtime','autoHistory']) if (data[key] != null && !Array.isArray(data[key])) throw new Error(`백업의 ${key} 배열이 올바르지 않습니다.`);
    const unique = (items, key, label) => {
      const seen = new Set();
      for (const item of items || []) {
        const id = String(item?.[key] || '');
        if (!id || seen.has(id)) throw new Error(`백업의 ${label} ID가 비어 있거나 중복됐습니다.`);
        seen.add(id);
      }
    };
    unique(data.rooms, 'chatId', '채팅방');
    unique(data.characterLibraries, 'scopeId', '설정집');
    if (Array.isArray(data.cognitionRooms)) unique(data.cognitionRooms, 'id', '인지 방');
    return sanitizeBackup(data);
  }
  const apiChatIdOf = room => room?.apiChatId || String(room?.chatId || '').split('::')[0] || '';
  const recordMatchesRooms = (record, roomIds) => {
    if (roomIds.has(String(record?.chatId || ''))) return true;
    if ([...roomIds].some(id => String(record?.id || '').includes(id))) return true;
    return !!record?.backup?.rooms?.some(room => roomIds.has(String(room?.chatId || '')));
  };
  async function restoreCoreBackup(raw, roomIds, libraryIds, restoreSettings = false) {
    const data = validateCoreBackup(raw);
    const selectedRooms = new Set([...roomIds].map(String));
    const selectedLibraries = new Set([...libraryIds].map(String));
    if (!selectedRooms.size && !selectedLibraries.size && !restoreSettings) throw new Error('복원할 방, 자료집 또는 공용 설정을 선택해 주세요.');
    for (const library of data.characterLibraries || []) {
      const id = String(library?.scopeId || ''), owner = String(library?.ownerChatId || '');
      const linked = selectedRooms.has(owner) || [...selectedRooms].some(roomId => id === `lore:auto:${roomId}`) || data.rooms.some(room => selectedRooms.has(String(room.chatId)) && [...(room.activeLorePackIds || []), room.autoCharacterLibraryId, room.lastExtraLibraryId].filter(Boolean).map(String).includes(id));
      if (linked) selectedLibraries.add(id);
      else if (library?.autoManaged === true) selectedLibraries.delete(id);
    }
    const db = await openWishDatabase();
    try {
      const existing = await readAllStores(db);
      if (existing.rooms.some(room => selectedRooms.has(String(room?.chatId || '')) && room?.pending)) throw new Error('선택한 방에 활성 주입이 있습니다. 원본 RP Manager에서 먼저 주입을 해제해 주세요.');
      const rooms = data.rooms.filter(room => selectedRooms.has(String(room.chatId))).map(room => {
        const next = clone(room), old = existing.rooms.find(item => String(item?.chatId) === String(room.chatId));
        next._epoch = crypto.randomUUID ? crypto.randomUUID() : `restore-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        next._rev = Number(old?._rev || 0) + 1;
        return next;
      });
      const apiIds = new Set(rooms.map(apiChatIdOf).filter(Boolean).map(String));
      const cognitionById = new Map((data.cognitionRooms || []).filter(item => apiIds.has(String(item?.id || ''))).map(item => {
        const normalized = clone(item);
        return [normalized.id, normalized];
      }));
      const libraries = data.characterLibraries.filter(item => selectedLibraries.has(String(item.scopeId))).map(clone);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES, 'readwrite');
        try {
          const roomStore = tx.objectStore('rooms');
          for (const room of rooms) roomStore.put(room);

          const cognitionStore = tx.objectStore('cognitionRooms');
          for (const id of apiIds) {
            cognitionStore.delete(id);
            const source = cognitionById.get(id);
            if (source) {
              const old = existing.cognitionRooms.find(item => String(item?.id) === id), next = clone(source);
              next.rev = Math.max(Number(old?.rev || 0), Number(next.rev || 0)) + 1;
              next.editRev = Math.max(Number(old?.editRev || 0), Number(next.editRev || 0)) + 1;
              cognitionStore.put(next);
            }
          }

          const libraryStore = tx.objectStore('characterLibraries');
          for (const item of existing.characterLibraries) {
            const id = String(item?.scopeId || ''), owner = String(item?.ownerChatId || '');
            if (item?.autoManaged === true && (selectedRooms.has(owner) || [...selectedRooms].some(roomId => id === `lore:auto:${roomId}`))) libraryStore.delete(id);
          }
          for (const item of libraries) libraryStore.put(item);

          const runtimeStore = tx.objectStore('runtime');
          for (const item of existing.runtime) if (item?.kind !== 'wish-lease' && isCoreRuntime(item) && recordMatchesRooms(item, selectedRooms)) runtimeStore.delete(item.id);
          for (const item of data.runtime || []) if (item?.kind !== 'wish-lease' && isCoreRuntime(item) && recordMatchesRooms(item, selectedRooms)) runtimeStore.put(clone(item));

          const historyStore = tx.objectStore('autoHistory');
          for (const item of existing.autoHistory) if (recordMatchesRooms(item, selectedRooms)) historyStore.delete(item.id);
          for (const item of data.autoHistory || []) if (recordMatchesRooms(item, selectedRooms)) historyStore.put(clone(item));
        } catch (error) {
          try { tx.abort(); } catch (_) {}
          reject(error);
          return;
        }
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('서버 백업 복원 트랜잭션에 실패했습니다.'));
      });
      for (const id of apiIds) {
        try { await bridge()?.invalidateRuntime?.(id); } catch (_) {}
      }
      if (restoreSettings) await restoreGlobalSettings(data);
      // The caller reloads immediately. Refreshing the old in-memory cognition bridge here can
      // race with the newly restored IndexedDB records and start a carrier sync during teardown.
      return { rooms:rooms.length, libraries:libraries.length, cognition:cognitionById.size, settings:!!restoreSettings };
    } finally { db.close(); }
  }

  function selectedCoreBackup(raw, roomIds, includeSettings) {
    const ids = new Set(roomIds.map(String));
    const data = sanitizeBackup(clone(raw));
    data.rooms = data.rooms.filter(room => ids.has(String(room.chatId))).map(room => ({ ...room, pending:null }));
    const apiIds = new Set(data.rooms.map(apiChatIdOf).filter(Boolean).map(String));
    const links = new Set(data.rooms.flatMap(room => [...(room.activeLorePackIds || []), room.autoCharacterLibraryId, room.lastExtraLibraryId, `lore:auto:${room.chatId}`].filter(Boolean)).map(String));
    data.characterLibraries = data.characterLibraries.filter(item => ids.has(String(item.ownerChatId || '')) || links.has(String(item.scopeId || '')));
    data.cognitionRooms = (data.cognitionRooms || []).filter(item => apiIds.has(String(item.id || '')));
    data.runtime = (data.runtime || []).filter(item => ids.has(String(item.chatId || '')));
    data.autoHistory = (data.autoHistory || []).filter(item => !item.backup && ids.has(String(item.chatId || '')));
    if (!includeSettings) for (const key of ['guides','defaultExtraPreset','cognitionSettings']) delete data[key];
    return validateCoreBackup(data);
  }
  async function openFirebaseBackupRoomPicker(provider = 'firebase') {
    if (busy || driveBusy) return;
    try {
      const snapshot = await createCoreBackup();
      const isDrive = provider === 'drive';
      const modal = createModal(`${isDrive ? 'Google Drive' : 'Firebase'}에 백업할 방 선택`, `Koofr와 별도 저장소입니다. 선택한 방과 연결 자료만 ${isDrive ? 'Google Drive' : 'Firebase'}에 올립니다.`);
      modal.body.innerHTML = `<label class="wish-inc-field"><span>백업 이름</span><input type="text" data-fbp-backup-label maxlength="80" value="${esc(`Wish 백업 ${new Date().toLocaleString('ko-KR')}`)}"></label><div class="wish-fbp-actions"><button type="button" data-fbp-current>현재 방만</button><button type="button" data-fbp-all>전체 선택</button><button type="button" data-fbp-none>선택 해제</button></div>${snapshot.rooms.map(room => `<label class="m3-cbx wish-fbp-room-row"><input type="checkbox" data-fbp-room value="${esc(room.chatId)}" ${String(apiChatIdOf(room)) === currentApiChatId() ? 'checked' : ''}><span class="m3-box"></span><span class="m3-t"><b>${esc(room.backupDisplayName || room.label || room.chatId)}</b><small>ID ${esc(room.chatId)}</small></span></label>`).join('') || '<p class="m3-muted">백업할 방이 없습니다.</p>'}<label class="m3-cbx wish-fbp-room-row"><input type="checkbox" data-fbp-global checked><span class="m3-box"></span><span class="m3-t">공용 지침·설정도 함께 저장</span></label>`;
      modal.footer.innerHTML = '<button type="button" data-fbp-cancel>취소</button><span></span><button type="button" class="primary" data-fbp-upload>선택한 방 백업</button>';
      modal.body.querySelector('[data-fbp-current]').onclick = () => modal.body.querySelectorAll('[data-fbp-room]').forEach(input => { input.checked = snapshot.rooms.some(room => String(room.chatId) === input.value && String(apiChatIdOf(room)) === currentApiChatId()); });
      modal.body.querySelector('[data-fbp-all]').onclick = () => modal.body.querySelectorAll('[data-fbp-room]').forEach(input => { input.checked = true; });
      modal.body.querySelector('[data-fbp-none]').onclick = () => modal.body.querySelectorAll('[data-fbp-room]').forEach(input => { input.checked = false; });
      modal.footer.querySelector('[data-fbp-cancel]').onclick = modal.close;
      modal.footer.querySelector('[data-fbp-upload]').onclick = async event => {
        const ids = [...modal.body.querySelectorAll('[data-fbp-room]:checked')].map(input => input.value);
        if (!ids.length) { notify('백업할 방을 한 개 이상 선택해 주세요.', 'warn'); return; }
        event.currentTarget.disabled = true;
        const payload = selectedCoreBackup(snapshot, ids, modal.body.querySelector('[data-fbp-global]').checked);
        const label = modal.body.querySelector('[data-fbp-backup-label]').value;
        modal.close();
        if (isDrive) { await uploadDriveBackup({ payload, label }); await refreshDriveCloud(); }
        else { await uploadBackup({ payload, label }); await refreshFirebaseCloud(); }
      };
    } catch (error) { notify(`백업할 방 준비 실패: ${error.message}`, 'error', 7600); }
  }
  async function uploadBackup({ payload, label } = {}) {
    if (busy) return;
    busy = true;
    try {
      const ready = await ensureReady();
      notify('선택한 방의 백업을 Firebase에 올리는 중…', 'info', 2600);
      payload ||= await createCoreBackup();
      const id = `W${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const meta = {
        id,
        manager:MANAGER_ID,
        source:'cloud-patch-1.0.0',
        label:String(label || '').trim().slice(0, 80) || `Wish 백업 ${new Date().toLocaleString('ko-KR')}`,
        createdAt:payload.exportedAt,
        version:String(payload.version || '1.5.3'),
        patchVersion:PATCH_VERSION,
        roomCount:payload.rooms.length,
        libraryCount:payload.characterLibraries.length,
      };
      await databaseRequest(ready.settings, 'PATCH', '', {
        [`${META_ROOT}/${ready.session.localId}/${id}`]:meta,
        [`${DATA_ROOT}/${ready.session.localId}/${id}`]:payload,
      });
      notify(`서버 백업 완료 · ${meta.label} · 방 ${meta.roomCount}개`, 'success', 5600);
    } catch (error) { notify(`서버 백업 실패: ${error.message}`, 'error', 7600); }
    finally { busy = false; }
  }
  async function fetchBackups() {
    const ready = await ensureReady();
    const raw = await databaseRequest(ready.settings, 'GET', `${META_ROOT}/${ready.session.localId}`);
    const items = Object.entries(raw || {}).map(([id, value]) => ({ id, ...(value && typeof value === 'object' ? value : {}) })).filter(item => item.manager === MANAGER_ID);
    items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return { ...ready, items };
  }
  async function deleteBackup(listed, id) {
    if (!/^W[a-z0-9_]+$/i.test(String(id || ''))) throw new Error('삭제할 서버 백업 ID가 올바르지 않습니다.');
    await databaseRequest(listed.settings, 'PATCH', '', {
      [`${META_ROOT}/${listed.session.localId}/${id}`]:null,
      [`${DATA_ROOT}/${listed.session.localId}/${id}`]:null,
    });
  }

  function driveConnected() { return !!driveAccessToken && driveExpiresAt > Date.now() + 30000; }
  function driveClientId() { return String(gmRead(DRIVE_CLIENT_KEY, '') || '').trim(); }
  function saveDriveClientId(value) {
    const clientId = String(value || '').trim();
    if (!/^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(clientId)) throw new Error('Google OAuth 웹 클라이언트 ID 형식을 확인해 주세요.');
    if (clientId !== driveClientId()) { driveAccessToken = ''; driveExpiresAt = 0; driveTokenClient = null; driveRows = []; driveLoaded = false; }
    gmWrite(DRIVE_CLIENT_KEY, clientId);
    return clientId;
  }
  function driveIdentity() { return (typeof unsafeWindow !== 'undefined' ? unsafeWindow.google : window.google)?.accounts?.oauth2; }
  function loadDriveIdentityScript() {
    if (driveIdentity()) return Promise.resolve();
    if (driveIdentityPromise) return driveIdentityPromise;
    driveIdentityPromise = new Promise((resolve, reject) => {
      const url = 'https://accounts.google.com/gsi/client';
      const script = typeof GM_addElement === 'function'
        ? GM_addElement('script', { src:url, async:true })
        : (() => { const node = document.createElement('script'); node.src = url; node.async = true; (document.head || document.documentElement).appendChild(node); return node; })();
      let settled = false;
      const finish = error => { if (settled) return; settled = true; clearInterval(timer); clearTimeout(limit); error ? reject(error) : resolve(); };
      const timer = setInterval(() => { if (driveIdentity()) finish(); }, 100);
      const limit = setTimeout(() => finish(new Error('Google 로그인 스크립트를 불러오지 못했습니다. 콘텐츠 차단 또는 사이트 보안 정책을 확인해 주세요.')), 15000);
      script?.addEventListener?.('error', () => finish(new Error('Google 로그인 스크립트가 차단되었습니다.')));
    }).catch(error => { driveIdentityPromise = null; throw error; });
    return driveIdentityPromise;
  }
  function connectDrive(clientId) {
    const oauth = driveIdentity();
    if (!oauth) throw new Error('Google 로그인 준비 중입니다. 잠시 후 연결을 다시 눌러 주세요.');
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(limit); error ? reject(error) : resolve(result); };
      const limit = setTimeout(() => finish(new Error('Google 계정 연결 시간이 초과되었습니다.')), 120000);
      try {
        driveTokenClient = oauth.initTokenClient({
          client_id:clientId,
          scope:DRIVE_SCOPE,
          callback:response => {
            if (response?.error || !response?.access_token) { finish(new Error(`Google 권한 승인이 완료되지 않았습니다${response?.error ? ` (${response.error})` : ''}.`)); return; }
            driveAccessToken = String(response.access_token);
            driveExpiresAt = Date.now() + Math.max(60, Number(response.expires_in) || 3600) * 1000;
            finish(null, response);
          },
          error_callback:error => finish(new Error(`Google 로그인 창을 완료하지 못했습니다 (${error?.type || 'popup_error'}).`)),
        });
        // Called synchronously from the click handler so mobile popup blockers permit the account chooser.
        driveTokenClient.requestAccessToken({ prompt:'' });
      } catch (error) { finish(error); }
    });
  }
  function driveHttp({ method = 'GET', url, data, headers = {}, raw = false, timeout = 120000, label = 'Google Drive 요청' }) {
    if (!driveConnected()) return Promise.reject(new Error('Google Drive 연결이 만료되었습니다. 다시 연결해 주세요.'));
    if (!/^https:\/\/(?:www\.googleapis\.com)(?:\/|$)/.test(url)) return Promise.reject(new Error('허용되지 않은 Google Drive 요청 주소입니다.'));
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method, url, data, timeout, headers:{ Authorization:`Bearer ${driveAccessToken}`, ...headers },
      onload:response => {
        if (!(response.status >= 200 && response.status < 300)) {
          let detail = '';
          try { const parsed = JSON.parse(response.responseText || '{}'); detail = parsed.error?.message || ''; } catch (_) {}
          if (response.status === 401) { driveAccessToken = ''; driveExpiresAt = 0; }
          reject(new Error(`${label} 실패 (HTTP ${response.status}${detail ? ` · ${detail}` : ''})`)); return;
        }
        if (raw) { resolve(response); return; }
        const responseText = String(response.responseText || '').trim();
        if (!responseText) { resolve(null); return; }
        try { resolve(JSON.parse(responseText)); } catch (_) { reject(new Error(`${label} 응답 JSON을 읽지 못했습니다.`)); }
      },
      ontimeout:() => reject(new Error(`${label} 시간이 초과되었습니다.`)),
      onerror:() => reject(new Error(`${label} 네트워크 연결에 실패했습니다.`)),
    }));
  }
  function driveQuery(query, fields, pageToken = '') {
    const params = new URLSearchParams({ q:query, fields, pageSize:'1000', spaces:'drive' });
    if (pageToken) params.set('pageToken', pageToken);
    return driveHttp({ url:`https://www.googleapis.com/drive/v3/files?${params}`, label:'Google Drive 목록' });
  }
  async function driveFolder() {
    const query = `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false`;
    const result = await driveQuery(query, 'files(id,name,mimeType),nextPageToken');
    if (result?.files?.[0]?.id) return result.files[0].id;
    const created = await driveHttp({
      method:'POST', url:'https://www.googleapis.com/drive/v3/files?fields=id,name',
      headers:{ 'Content-Type':'application/json; charset=UTF-8' },
      data:JSON.stringify({ name:DRIVE_FOLDER_NAME, mimeType:'application/vnd.google-apps.folder', parents:['root'] }), label:'Google Drive 백업 폴더 생성',
    });
    if (!created?.id) throw new Error('Google Drive 백업 폴더 ID를 확인할 수 없습니다.');
    return created.id;
  }
  function validDriveId(id) { if (!/^[A-Za-z0-9_-]{8,}$/.test(String(id || ''))) throw new Error('Google Drive 파일 ID가 올바르지 않습니다.'); return id; }
  async function uploadDriveBackup({ payload, label }) {
    if (driveBusy) return;
    driveBusy = true;
    try {
      const folderId = await driveFolder();
      const name = String(label || '').trim().slice(0, 80) || `Wish 백업 ${new Date().toLocaleString('ko-KR')}`;
      const safeName = name.replace(/[\\/:*?"<>|]/g, '_');
      const json = JSON.stringify(validateCoreBackup(payload));
      const bytes = new TextEncoder().encode(json);
      const metadata = {
        name:`${safeName}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        mimeType:'application/json', parents:[folderId], description:`Wish RP Manager Core 백업 · ${name}`,
        appProperties:{ manager:MANAGER_ID, label:name, roomCount:String(payload.rooms.length), libraryCount:String(payload.characterLibraries.length), version:String(payload.version || '1.5.3'), patchVersion:PATCH_VERSION },
      };
      const session = await driveHttp({
        method:'POST', url:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name', raw:true,
        headers:{ 'Content-Type':'application/json; charset=UTF-8', 'X-Upload-Content-Type':'application/json', 'X-Upload-Content-Length':String(bytes.byteLength) },
        data:JSON.stringify(metadata), label:'Google Drive 업로드 시작',
      });
      const uploadUrl = String(session.responseHeaders || '').match(/^location:\s*(https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[^\r\n]+)$/im)?.[1];
      if (!uploadUrl) throw new Error('Google Drive 업로드 세션 주소를 받지 못했습니다.');
      const uploaded = await driveHttp({ method:'PUT', url:uploadUrl, data:bytes.buffer, headers:{ 'Content-Type':'application/json', 'Content-Length':String(bytes.byteLength) }, timeout:300000, label:'Google Drive 백업 업로드' });
      if (!uploaded?.id) throw new Error('Google Drive가 업로드 완료 파일 ID를 반환하지 않았습니다.');
      notify(`Google Drive 백업 완료 · ${name} · 방 ${payload.rooms.length}개`, 'success', 5600);
    } catch (error) { notify(`Google Drive 백업 실패: ${error.message}`, 'error', 8000); }
    finally { driveBusy = false; renderDriveCloudPanel(currentCloudDialog() || document.createElement('div')); }
  }
  async function listDriveBackups() {
    const folderId = await driveFolder();
    const items = [];
    let pageToken = '';
    do {
      const query = `'${folderId}' in parents and trashed = false`;
      const page = await driveQuery(query, 'nextPageToken,files(id,name,mimeType,createdTime,size,appProperties,parents)', pageToken);
      items.push(...(page?.files || []).filter(file => file.appProperties?.manager === MANAGER_ID && file.mimeType === 'application/json').map(file => ({
        id:file.id, label:file.appProperties.label || file.name, createdAt:file.createdTime, roomCount:Number(file.appProperties.roomCount || 0), libraryCount:Number(file.appProperties.libraryCount || 0), version:file.appProperties.version || '?', size:Number(file.size || 0), folderId,
      })));
      pageToken = String(page?.nextPageToken || '');
    } while (pageToken);
    items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return items;
  }
  async function downloadDriveBackup(id) {
    validDriveId(id);
    const response = await driveHttp({ url:`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, raw:true, label:'Google Drive 백업 내려받기' });
    let data;
    try { data = JSON.parse(String(response.responseText || '')); } catch (_) { throw new Error('백업 JSON을 읽지 못했습니다.'); }
    return validateCoreBackup(data);
  }
  async function trashDriveBackup(id) {
    validDriveId(id);
    await driveHttp({ method:'PATCH', url:`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`, headers:{ 'Content-Type':'application/json; charset=UTF-8' }, data:JSON.stringify({ trashed:true }), label:'Google Drive 백업 휴지통 이동' });
  }

  function closePatchModal() { document.querySelector('.wish-fbp-overlay')?.remove(); }
  function createModal(title, description = '') {
    closePatchModal();
    const overlay = document.createElement('div');
    overlay.className = 'wish-fbp-overlay';
    overlay.innerHTML = `<div class="wish-fbp-modal" role="dialog" aria-modal="true"><header><div><b>${esc(title)}</b>${description ? `<small>${esc(description)}</small>` : ''}</div><button type="button" data-fbp-close aria-label="닫기">✕</button></header><div class="wish-fbp-body"></div><footer></footer></div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-fbp-close]').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };
    return { overlay, body:overlay.querySelector('.wish-fbp-body'), footer:overlay.querySelector('footer'), close };
  }
  async function openBackupList() {
    if (busy) return;
    busy = true;
    try {
      notify('Firebase 서버 백업 목록을 읽는 중…', 'info', 1800);
      const listed = await fetchBackups();
      const modal = createModal('Firebase 서버 백업 목록', `Wish RP Manager Core 백업 ${listed.items.length}개`);
      modal.body.innerHTML = listed.items.length ? listed.items.map((item, index) => `<label class="wish-fbp-row"><input type="radio" name="wish-fbp-backup" value="${esc(item.id)}" ${index === 0 ? 'checked' : ''}><span><b>${esc(item.label || '이름 없는 백업')}</b><small>${esc(item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '생성 시각 미상')} · 방 ${Number(item.roomCount || 0).toLocaleString('ko-KR')}개 · 자료집 ${Number(item.libraryCount || 0).toLocaleString('ko-KR')}개 · v${esc(item.version || '?')}</small></span></label>`).join('') : '<div class="wish-fbp-empty">서버에 저장된 Core 백업이 없습니다.</div>';
      modal.footer.innerHTML = `<button type="button" class="danger" data-fbp-delete ${listed.items.length ? '' : 'disabled'}>선택 백업 삭제</button><span></span><button type="button" data-fbp-cancel>닫기</button><button type="button" class="primary" data-fbp-load ${listed.items.length ? '' : 'disabled'}>선택 백업 불러오기</button>`;
      const selectedId = () => modal.overlay.querySelector('input[name="wish-fbp-backup"]:checked')?.value || '';
      modal.footer.querySelector('[data-fbp-cancel]').onclick = modal.close;
      modal.footer.querySelector('[data-fbp-delete]').onclick = async event => {
        const id = selectedId(), item = listed.items.find(row => String(row.id) === String(id));
        if (!item || !confirm(`서버 백업을 영구 삭제할까요?\n\n${item.label || '이름 없는 백업'}\n${item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '생성 시각 미상'}\n\n이 작업은 되돌릴 수 없습니다.`)) return;
        event.currentTarget.disabled = true;
        try { await deleteBackup(listed, id); notify('서버 백업을 삭제했습니다.', 'success'); modal.close(); busy = false; await openBackupList(); }
        catch (error) { notify(`서버 백업 삭제 실패: ${error.message}`, 'error', 7000); event.currentTarget.disabled = false; }
      };
      modal.footer.querySelector('[data-fbp-load]').onclick = async event => {
        const id = selectedId();
        if (!id) return;
        event.currentTarget.disabled = true;
        try {
          notify('서버 백업을 내려받아 검사하는 중…', 'info', 1800);
          const raw = await databaseRequest(listed.settings, 'GET', `${DATA_ROOT}/${listed.session.localId}/${id}`);
          const backup = validateCoreBackup(raw);
          modal.close();
          await openRestoreSelection(backup);
        } catch (error) { notify(`서버 백업 불러오기 실패: ${error.message}`, 'error', 7600); event.currentTarget.disabled = false; }
      };
    } catch (error) { notify(`서버 백업 목록 실패: ${error.message}`, 'error', 7600); }
    finally { busy = false; }
  }
  async function openRestoreSelection(backup) {
    const db = await openWishDatabase();
    let existing;
    try { existing = await readAllStores(db); }
    finally { db.close(); }
    const pendingIds = new Set(existing.rooms.filter(room => room?.pending).map(room => String(room.chatId)));
    const currentApi = String(location.pathname.match(/\/(?:chats|c|episodes)\/([^/?#]+)/)?.[1] || '');
    const rooms = backup.rooms.filter(room => room?.chatId);
    const libraries = backup.characterLibraries.filter(item => item?.scopeId);
    const modal = createModal('서버 백업 선택 복원', '선택한 Wish 로컬 데이터만 교체하고 완료 즉시 페이지를 새로고침합니다.');
    modal.body.innerHTML = `<div class="wish-fbp-toolbar"><button type="button" data-pick-current>현재 방만</button><button type="button" data-pick-all>전체 선택</button><button type="button" data-pick-none>선택 해제</button><span data-pick-count>0개 선택</span></div><h3>RP 채팅방 · ${rooms.length}개</h3>${rooms.map(room => { const id=String(room.chatId), blocked=pendingIds.has(id), current=apiChatIdOf(room)===currentApi; return `<label class="wish-fbp-row ${blocked?'blocked':''}"><input type="checkbox" data-room-id="${esc(id)}" ${blocked?'disabled':''}><span><b>${current?'● ':''}${esc(room.backupDisplayName || room.label || `RP ${id.slice(-8)}`)}</b><small>${blocked?'현재 활성 주입 때문에 복원 제외':`기억 슬롯 ${Array.isArray(room.slots)?room.slots.length:0}개`}</small></span></label>`; }).join('') || '<div class="wish-fbp-empty">백업에 채팅방 데이터가 없습니다.</div>'}<h3>자료집 · ${libraries.length}개</h3>${libraries.map(item => `<label class="wish-fbp-row"><input type="checkbox" data-library-id="${esc(item.scopeId)}"><span><b>${esc(item.name || item.title || item.scopeId)}</b><small>${Array.isArray(item.entries)?item.entries.length:Array.isArray(item.characters)?item.characters.length:0}개 항목${item.ownerChatId?' · 방 연결 자료':''}</small></span></label>`).join('') || '<div class="wish-fbp-empty">백업에 자료집 데이터가 없습니다.</div>'}<h3>공용 설정</h3><label class="wish-fbp-row"><input type="checkbox" data-global-settings><span><b>공용 지침 · 기본 프리셋 · 인지 설정</b><small>원본 파일 백업과 같은 전역 설정 묶음</small></span></label><div class="wish-fbp-note">활성 주입 중인 방은 선택할 수 없습니다. API 키와 패치 로그인 정보는 백업에 포함되지 않습니다.</div>`;
    modal.footer.innerHTML = '<span></span><button type="button" data-fbp-cancel>취소</button><button type="button" class="primary" data-fbp-restore disabled>선택 항목 복원</button>';
    const boxes = () => [...modal.body.querySelectorAll('input[type="checkbox"]:not(:disabled)')];
    const update = () => {
      const count = boxes().filter(box => box.checked).length;
      modal.body.querySelector('[data-pick-count]').textContent = `${count}개 선택`;
      modal.footer.querySelector('[data-fbp-restore]').disabled = count === 0;
    };
    modal.body.querySelector('[data-pick-current]').onclick = () => { boxes().forEach(box => { box.checked = !!box.dataset.roomId && apiChatIdOf(rooms.find(room => String(room.chatId) === box.dataset.roomId)) === currentApi; }); update(); };
    modal.body.querySelector('[data-pick-all]').onclick = () => { boxes().forEach(box => { box.checked = true; }); update(); };
    modal.body.querySelector('[data-pick-none]').onclick = () => { boxes().forEach(box => { box.checked = false; }); update(); };
    boxes().forEach(box => box.onchange = update);
    modal.footer.querySelector('[data-fbp-cancel]').onclick = modal.close;
    modal.footer.querySelector('[data-fbp-restore]').onclick = async event => {
      const roomIds = new Set(boxes().filter(box => box.checked && box.dataset.roomId).map(box => box.dataset.roomId));
      const libraryIds = new Set(boxes().filter(box => box.checked && box.dataset.libraryId).map(box => box.dataset.libraryId));
      const restoreSettings = !!modal.body.querySelector('[data-global-settings]')?.checked;
      if (!confirm(`선택한 서버 백업을 복원할까요?\n\n방 ${roomIds.size}개 · 직접 선택 자료집 ${libraryIds.size}개 · 공용 설정 ${restoreSettings?'포함':'제외'}\n기존 Wish 로컬 데이터가 교체되고 페이지가 바로 새로고침됩니다.`)) return;
      event.currentTarget.disabled = true;
      try {
        const result = await restoreCoreBackup(backup, roomIds, libraryIds, restoreSettings);
        sessionStorage.setItem(RESTORE_NOTICE_KEY, `서버 백업 복원 완료 · 방 ${result.rooms}개 · 자료집 ${result.libraries}개 · 인지 ${result.cognition}개${result.settings?' · 공용 설정 포함':''}`);
        location.reload();
      } catch (error) { notify(`서버 백업 복원 실패: ${error.message}`, 'error', 8000); event.currentTarget.disabled = false; }
    };
    update();
  }

  function readSectionSettings(section) {
    return {
      apiKey:section.querySelector('[data-fbp-api-key]')?.value || '',
      databaseURL:section.querySelector('[data-fbp-db-url]')?.value || '',
      email:section.querySelector('[data-fbp-email]')?.value || '',
    };
  }
  function setSectionStatus(section, message, type = '') {
    const status = section.querySelector('[data-fbp-status]');
    if (!status) return;
    status.className = `wish-fbp-status ${type}`;
    status.textContent = message;
  }
  function injectApiSettings(dialog) {
    const body = dialog.querySelector('.m3-dialog-body');
    if (!body || body.querySelector('[data-wish-fbp-settings]')) return;
    const id = String(dialog.dataset.dlg || 'cloud');
    const saved = loadSettings();
    const draft = apiDrafts.get(id) || { ...saved, password:'' };
    apiDrafts.set(id, draft);
    const section = document.createElement('section');
    section.className = 'm3-grp wish-fbp-settings';
    section.setAttribute('data-wish-fbp-settings', '');
    section.setAttribute('data-fx-node', '');
    section.innerHTML = `<div class="m3-gt">☁ Firebase 서버 백업 · Patch v${PATCH_VERSION}</div><label><span>Web API Key</span><input type="text" data-fbp-api-key value="${esc(draft.apiKey)}" placeholder="AIza…"></label><label><span>Realtime Database URL</span><input type="url" data-fbp-db-url value="${esc(draft.databaseURL)}" placeholder="https://project.firebaseio.com"></label><div class="wish-fbp-grid"><label><span>로그인 이메일</span><input type="email" data-fbp-email value="${esc(draft.email)}"></label><label><span>비밀번호 · 연결할 때만</span><input type="password" data-fbp-password value="${esc(draft.password)}" placeholder="저장하지 않음"></label></div><div class="wish-fbp-status ${connected(saved)?'ok':''}" data-fbp-status>${connected(saved)?'Firebase 서버 백업 연결됨':'설정값은 이 패치에만 저장됩니다. 비밀번호는 저장하지 않습니다.'}</div><div class="wish-fbp-actions"><button type="button" class="m3-btn mini" data-fbp-save>설정 저장</button><button type="button" class="m3-btn mini primary" data-fbp-connect>저장 후 연결</button><button type="button" class="m3-btn mini quiet" data-fbp-logout>서버 로그아웃</button></div>`;
    body.appendChild(section);
    const syncDraft = () => Object.assign(draft, readSectionSettings(section), { password:section.querySelector('[data-fbp-password]').value });
    section.addEventListener('input', syncDraft);
    section.querySelector('[data-fbp-save]').onclick = () => {
      try { syncDraft(); saveSettings(draft); setSectionStatus(section, '서버 백업 설정을 저장했습니다.', 'ok'); notify('Firebase 서버 백업 설정 저장 완료', 'success'); }
      catch (error) { setSectionStatus(section, error.message, 'error'); }
    };
    section.querySelector('[data-fbp-connect]').onclick = async event => {
      if (busy) return;
      busy = true;
      event.currentTarget.disabled = true;
      try {
        syncDraft();
        const settings = saveSettings(draft);
        setSectionStatus(section, 'Firebase 연결을 확인하는 중…', 'busy');
        let session = await getSession(settings);
        if (!session || draft.password) session = await signIn(settings, draft.password);
        await databaseRequest(settings, 'GET', `${META_ROOT}/${session.localId}`);
        draft.password = '';
        section.querySelector('[data-fbp-password]').value = '';
        setSectionStatus(section, 'Firebase 서버 백업 연결됨', 'ok');
        notify('Firebase 서버 백업 연결 완료', 'success');
      } catch (error) { setSectionStatus(section, error.message, 'error'); notify(`서버 백업 연결 실패: ${error.message}`, 'error', 7000); }
      finally { busy = false; event.currentTarget.disabled = false; }
    };
    section.querySelector('[data-fbp-logout]').onclick = () => {
      clearSession();
      draft.password = '';
      section.querySelector('[data-fbp-password]').value = '';
      setSectionStatus(section, '서버 백업에서 로그아웃했습니다.', '');
      notify('Firebase 서버 백업 로그아웃 완료', 'success');
    };
  }
  function renderFirebaseCloudPanel(dialog) {
    const panel = dialog.querySelector('[data-wish-fbp-cloud]');
    if (!panel) return;
    const ready = connected();
    if (!cloudRows.some(item => item.id === cloudSelectedId)) cloudSelectedId = cloudRows[0]?.id || '';
    const signature = JSON.stringify({ ready, loading:cloudLoading, busy, error:cloudError, loaded:cloudLoaded, rows:cloudRows, selected:cloudSelectedId });
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;
    const rows = cloudRows.map(item => { const selected = item.id === cloudSelectedId; return `<div class="m3-cloud-row wish-cloud-choice ${selected ? 'is-selected' : ''}" data-key="firebase-${esc(item.id)}" aria-selected="${selected}"><label class="m3-cloud-info m3-cbx m3-cloud-pick ${selected ? 'is-on' : ''}" style="padding:0;margin:0"><input type="radio" name="wish-fbp-firebase-backup" value="${esc(item.id)}" data-fbp-cloud-select ${selected ? 'checked' : ''}><span class="m3-box" aria-hidden="true"></span><span class="m3-t"><b>${esc(item.label || '이름 없는 백업')}${selected ? '<em class="wish-cloud-selected">✓ 선택됨</em>' : ''}</b><small>${esc(item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '생성 시각 미상')} · 방 ${Number(item.roomCount || 0)}개 · 자료집 ${Number(item.libraryCount || 0)}개 · v${esc(item.version || '?')}</small></span></label><div class="m3-row m3-cloud-actions"><button type="button" class="m3-btn mini" data-fbp-cloud-restore="${esc(item.id)}" ${busy ? 'disabled' : ''}>복원</button><button type="button" class="m3-btn mini danger" data-fbp-cloud-delete="${esc(item.id)}" ${busy ? 'disabled' : ''}>삭제</button></div></div>`; }).join('');
    panel.innerHTML = `<section class="m3-panel" data-key="firebase-cloud-head"><b>${ready ? 'Firebase 연결됨' : 'Firebase 연결 설정이 필요합니다'}</b><div class="m3-muted">Firebase Realtime Database · 계정별 개인 백업 · 암호화하지 않은 JSON</div><div class="m3-status m3-topgap">수동 저장·불러오기 · Koofr 백업과 별도 목록</div><div class="m3-row m3-card-actions"><button type="button" class="m3-btn mini primary" data-fbp-cloud-upload ${!ready || busy || cloudLoading ? 'disabled' : ''}>방 골라 백업</button><button type="button" class="m3-btn mini" data-fbp-cloud-refresh ${!ready || busy || cloudLoading ? 'disabled' : ''}>목록 새로고침</button></div></section>${cloudError ? `<section class="m3-panel m3-alert"><b>Firebase 목록 오류</b><p>${esc(cloudError)}</p></section>` : ''}${cloudLoading ? '<p class="m3-muted" role="status">Firebase 목록 확인 중…</p>' : rows ? `<div class="m3-cloud-group"><div class="m3-cloud-title">내 Firebase 백업<small>${cloudRows.length}개</small></div>${rows}</div>` : `<p class="m3-muted">${cloudLoaded ? '저장된 Firebase 백업이 없습니다.' : '목록 새로고침을 눌러 저장된 백업을 확인하세요.'}</p>`}`;
    panel.querySelector('[data-fbp-cloud-upload]').onclick = () => { void openFirebaseBackupRoomPicker(); };
    panel.querySelector('[data-fbp-cloud-refresh]').onclick = () => { void refreshFirebaseCloud(); };
    panel.querySelectorAll('[data-fbp-cloud-select]').forEach(input => { input.onchange = () => { cloudSelectedId = input.value; renderFirebaseCloudPanel(dialog); }; });
    panel.querySelectorAll('[data-fbp-cloud-restore]').forEach(button => { button.onclick = () => { cloudSelectedId = button.dataset.fbpCloudRestore; void restoreFirebaseCloudItem(cloudSelectedId); }; });
    panel.querySelectorAll('[data-fbp-cloud-delete]').forEach(button => { button.onclick = () => { cloudSelectedId = button.dataset.fbpCloudDelete; renderFirebaseCloudPanel(dialog); void deleteFirebaseCloudItem(cloudSelectedId); }; });
  }
  function currentCloudDialog() { return [...document.querySelectorAll('#wish-rp-root .m3-dialog')].find(dialog => dialog.querySelector('[data-wish-fbp-cloud]')) || null; }
  async function refreshFirebaseCloud() {
    if (busy || cloudLoading) return;
    cloudLoading = true; cloudError = ''; renderFirebaseCloudPanel(currentCloudDialog() || document.createElement('div'));
    try { const listed = await fetchBackups(); cloudRows = listed.items; cloudLoaded = true; }
    catch (error) { cloudError = error.message; notify(`Firebase 목록 실패: ${error.message}`, 'error', 7600); }
    finally { cloudLoading = false; const dialog = currentCloudDialog(); if (dialog) renderFirebaseCloudPanel(dialog); }
  }
  async function restoreFirebaseCloudItem(id) {
    if (busy) return;
    busy = true; const dialog = currentCloudDialog(); if (dialog) renderFirebaseCloudPanel(dialog);
    try {
      const listed = await fetchBackups();
      if (!listed.items.some(item => item.id === id)) throw new Error('백업 목록을 다시 확인해 주세요.');
      const raw = await databaseRequest(listed.settings, 'GET', `${DATA_ROOT}/${listed.session.localId}/${id}`);
      await openRestoreSelection(validateCoreBackup(raw));
    } catch (error) { notify(`Firebase 복원 준비 실패: ${error.message}`, 'error', 7600); }
    finally { busy = false; const current = currentCloudDialog(); if (current) renderFirebaseCloudPanel(current); }
  }
  async function deleteFirebaseCloudItem(id) {
    if (busy) return;
    const item = cloudRows.find(row => row.id === id);
    if (!item || !confirm(`Firebase 백업을 영구 삭제할까요?\n\n${item.label || '이름 없는 백업'}\n\nKoofr와 로컬 자료는 그대로 남습니다.`)) return;
    busy = true; const dialog = currentCloudDialog(); if (dialog) renderFirebaseCloudPanel(dialog);
    try { const listed = await fetchBackups(); await deleteBackup(listed, id); cloudRows = cloudRows.filter(row => row.id !== id); notify('Firebase 백업을 삭제했습니다.', 'success'); }
    catch (error) { notify(`Firebase 백업 삭제 실패: ${error.message}`, 'error', 7600); }
    finally { busy = false; const current = currentCloudDialog(); if (current) renderFirebaseCloudPanel(current); }
  }
  function injectDriveSettings(dialog) {
    const body = dialog.querySelector('.m3-dialog-body');
    if (!body || body.querySelector('[data-wish-drive-settings]')) return;
    const section = document.createElement('section');
    section.className = 'm3-grp wish-fbp-settings wish-drive-settings';
    section.setAttribute('data-wish-drive-settings', '');
    section.setAttribute('data-fx-node', '');
    section.innerHTML = `<div class="m3-gt">☁ Google Drive 백업 · Patch v${PATCH_VERSION}</div><label><span>Google OAuth 웹 클라이언트 ID</span><input type="text" data-drive-client-id value="${esc(driveClientId())}" placeholder="123456789-....apps.googleusercontent.com" autocapitalize="off" spellcheck="false"></label><details class="wish-drive-help"><summary aria-label="Google Drive 설정 및 클라이언트 ID 발급 안내">?</summary><div><b>Google Drive 사용 준비</b><br>1. <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>에서 프로젝트를 새로 만들거나 사용할 프로젝트를 선택합니다.<br>2. <b>API 및 서비스 → 라이브러리</b>에서 <b>Google Drive API</b>를 검색해 사용 설정합니다.<br>3. <b>Google Auth Platform → 대상</b>에서 앱이 테스트 상태라면 실제로 백업에 사용할 Google 계정을 <b>테스트 사용자</b>로 추가합니다.<br>4. <b>Google Auth Platform → 데이터 액세스</b>에서 범위 <code>https://www.googleapis.com/auth/drive.file</code>을 추가합니다.<br>5. <b>API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID</b>로 이동하고 애플리케이션 유형은 <b>웹 애플리케이션</b>을 선택합니다.<br>6. <b>승인된 JavaScript 원본</b>에 <code>https://crack.wrtn.ai</code>를 정확히 등록한 뒤 생성합니다. 리디렉션 URI는 따로 입력하지 않아도 됩니다.<br>7. 생성된 <b>클라이언트 ID</b>만 위 입력칸에 붙여넣고 <b>설정 저장 → Google 계정 연결</b> 순서로 누릅니다. 클라이언트 보안 비밀번호는 입력하지 않습니다.<br>8. Google 승인 화면에서 사용할 계정을 선택하고 Drive 파일 접근을 허용합니다.<br><br>연결 후 내 드라이브에 <code>Wish-Core-Backups</code> 폴더가 자동 생성되며, 삭제한 백업은 Google Drive 휴지통으로 이동합니다. 모바일에서는 로그인 팝업이 차단되면 해당 사이트의 팝업 허용 후 다시 연결해 주세요.</div></details><div class="wish-fbp-status ${driveConnected() ? 'ok' : ''}" data-drive-status>${driveConnected() ? 'Google Drive 연결됨' : '클라이언트 ID 저장 후 연결을 눌러 Google 계정을 선택해 주세요.'}</div><div class="wish-fbp-actions"><button type="button" class="m3-btn mini" data-drive-save>설정 저장</button><button type="button" class="m3-btn mini primary" data-drive-connect>Google 계정 연결</button><button type="button" class="m3-btn mini quiet" data-drive-disconnect>연결 해제</button></div><div class="m3-muted m3-topgap">Chrome·Edge에서 이미 로그인한 계정을 선택할 수 있지만 Drive 접근 승인에는 클라이언트 ID가 필요합니다. 토큰은 이 탭의 메모리에만 보관합니다.</div>`;
    body.appendChild(section);
    const status = (message, type = '') => { const target = section.querySelector('[data-drive-status]'); target.textContent = message; target.className = `wish-fbp-status ${type}`; };
    section.querySelector('[data-drive-save]').onclick = () => {
      try { saveDriveClientId(section.querySelector('[data-drive-client-id]').value); status('클라이언트 ID를 저장했습니다. 계정 연결을 눌러 주세요.', 'ok'); notify('Google Drive 설정 저장 완료', 'success'); }
      catch (error) { status(error.message, 'error'); }
    };
    section.querySelector('[data-drive-connect]').onclick = event => {
      if (driveBusy) return;
      let promise;
      try {
        const clientId = saveDriveClientId(section.querySelector('[data-drive-client-id]').value);
        promise = connectDrive(clientId);
      } catch (error) { status(error.message, 'error'); void loadDriveIdentityScript().catch(() => {}); return; }
      driveBusy = true;
      event.currentTarget.disabled = true;
      status('Google 계정 승인 대기 중…', 'busy');
      void promise.then(async () => {
        status('Google Drive 연결됨', 'ok');
        notify('Google Drive 연결 완료', 'success');
        driveLoaded = false;
      }).catch(error => { status(error.message, 'error'); notify(`Google Drive 연결 실패: ${error.message}`, 'error', 7600); })
        .finally(() => { driveBusy = false; event.currentTarget.disabled = false; renderDriveCloudPanel(dialog); if (driveConnected()) void refreshDriveCloud(); });
    };
    section.querySelector('[data-drive-disconnect]').onclick = () => {
      const token = driveAccessToken;
      driveAccessToken = ''; driveExpiresAt = 0; driveTokenClient = null; driveRows = []; driveLoaded = false;
      if (token) { try { driveIdentity()?.revoke(token, () => {}); } catch (_) {} }
      status('Google Drive 연결이 해제되었습니다. 클라이언트 ID는 유지됩니다.', '');
      renderDriveCloudPanel(dialog);
    };
  }
  function renderDriveCloudPanel(dialog) {
    const panel = dialog.querySelector('[data-wish-drive-cloud]');
    if (!panel) return;
    const ready = driveConnected();
    if (!driveRows.some(item => item.id === driveSelectedId)) driveSelectedId = driveRows[0]?.id || '';
    const signature = JSON.stringify({ ready, loading:driveLoading, busy:driveBusy, error:driveError, loaded:driveLoaded, rows:driveRows, selected:driveSelectedId });
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;
    const rows = driveRows.map(item => { const selected = item.id === driveSelectedId; return `<div class="m3-cloud-row wish-cloud-choice ${selected ? 'is-selected' : ''}" data-key="drive-${esc(item.id)}" aria-selected="${selected}"><label class="m3-cloud-info m3-cbx m3-cloud-pick ${selected ? 'is-on' : ''}" style="padding:0;margin:0"><input type="radio" name="wish-fbp-drive-backup" value="${esc(item.id)}" data-drive-select ${selected ? 'checked' : ''}><span class="m3-box" aria-hidden="true"></span><span class="m3-t"><b>${esc(item.label || '이름 없는 백업')}${selected ? '<em class="wish-cloud-selected">✓ 선택됨</em>' : ''}</b><small>${esc(item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '생성 시각 미상')} · 방 ${Number(item.roomCount || 0)}개 · 자료집 ${Number(item.libraryCount || 0)}개 · v${esc(item.version || '?')}</small></span></label><div class="m3-row m3-cloud-actions"><button type="button" class="m3-btn mini" data-drive-restore="${esc(item.id)}" ${driveBusy ? 'disabled' : ''}>복원</button><button type="button" class="m3-btn mini danger" data-drive-delete="${esc(item.id)}" ${driveBusy ? 'disabled' : ''}>삭제</button></div></div>`; }).join('');
    panel.innerHTML = `<section class="m3-panel" data-key="drive-cloud-head"><b>${ready ? 'Google Drive 연결됨' : 'Google Drive 연결 설정이 필요합니다'}</b><div class="m3-muted">내 드라이브 / ${DRIVE_FOLDER_NAME} · 암호화하지 않은 JSON</div><div class="m3-status m3-topgap">수동 저장·불러오기 · Koofr/Firebase와 별도 목록 · 삭제 시 휴지통 이동</div><div class="m3-row m3-card-actions"><button type="button" class="m3-btn mini primary" data-drive-upload ${!ready || driveBusy || driveLoading ? 'disabled' : ''}>방 골라 백업</button><button type="button" class="m3-btn mini" data-drive-refresh ${!ready || driveBusy || driveLoading ? 'disabled' : ''}>목록 새로고침</button></div></section>${driveError ? `<section class="m3-panel m3-alert"><b>Google Drive 목록 오류</b><p>${esc(driveError)}</p></section>` : ''}${driveLoading ? '<p class="m3-muted" role="status">Google Drive 목록 확인 중…</p>' : rows ? `<div class="m3-cloud-group"><div class="m3-cloud-title">내 Google Drive 백업<small>${driveRows.length}개</small></div>${rows}</div>` : `<p class="m3-muted">${driveLoaded ? '저장된 Google Drive 백업이 없습니다.' : '계정을 연결하고 목록 새로고침을 눌러 주세요.'}</p>`}`;
    panel.querySelector('[data-drive-upload]').onclick = () => { void openFirebaseBackupRoomPicker('drive'); };
    panel.querySelector('[data-drive-refresh]').onclick = () => { void refreshDriveCloud(); };
    panel.querySelectorAll('[data-drive-select]').forEach(input => { input.onchange = () => { driveSelectedId = input.value; renderDriveCloudPanel(dialog); }; });
    panel.querySelectorAll('[data-drive-restore]').forEach(button => { button.onclick = () => { driveSelectedId = button.dataset.driveRestore; void restoreDriveCloudItem(driveSelectedId); }; });
    panel.querySelectorAll('[data-drive-delete]').forEach(button => { button.onclick = () => { driveSelectedId = button.dataset.driveDelete; renderDriveCloudPanel(dialog); void deleteDriveCloudItem(driveSelectedId); }; });
  }
  async function refreshDriveCloud() {
    if (driveBusy || driveLoading || !driveConnected()) return;
    driveLoading = true; driveError = ''; renderDriveCloudPanel(currentCloudDialog() || document.createElement('div'));
    try { driveRows = await listDriveBackups(); driveLoaded = true; }
    catch (error) { driveError = error.message; notify(`Google Drive 목록 실패: ${error.message}`, 'error', 7600); }
    finally { driveLoading = false; const dialog = currentCloudDialog(); if (dialog) renderDriveCloudPanel(dialog); }
  }
  async function restoreDriveCloudItem(id) {
    if (driveBusy) return;
    driveBusy = true; const dialog = currentCloudDialog(); if (dialog) renderDriveCloudPanel(dialog);
    try {
      if (!driveRows.some(item => item.id === id)) throw new Error('백업 목록을 다시 확인해 주세요.');
      await openRestoreSelection(await downloadDriveBackup(id));
    } catch (error) { notify(`Google Drive 복원 준비 실패: ${error.message}`, 'error', 7600); }
    finally { driveBusy = false; const current = currentCloudDialog(); if (current) renderDriveCloudPanel(current); }
  }
  async function deleteDriveCloudItem(id) {
    if (driveBusy) return;
    const item = driveRows.find(row => row.id === id);
    if (!item || !confirm(`Google Drive 백업을 휴지통으로 이동할까요?\n\n${item.label || '이름 없는 백업'}\n\nGoogle Drive 휴지통에서 복구할 수 있습니다.`)) return;
    driveBusy = true; const dialog = currentCloudDialog(); if (dialog) renderDriveCloudPanel(dialog);
    try { await trashDriveBackup(id); driveRows = driveRows.filter(row => row.id !== id); notify('Google Drive 백업을 휴지통으로 이동했습니다.', 'success'); }
    catch (error) { notify(`Google Drive 백업 삭제 실패: ${error.message}`, 'error', 7600); }
    finally { driveBusy = false; const current = currentCloudDialog(); if (current) renderDriveCloudPanel(current); }
  }
  function updateCloudModeStyle(dialog) {
    const id = String(dialog.dataset.dlg || '');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return;
    let modeStyle = document.getElementById('wish-fbp-cloud-mode-style');
    if (!modeStyle) {
      modeStyle = document.createElement('style');
      modeStyle.id = 'wish-fbp-cloud-mode-style';
      (document.head || document.documentElement).appendChild(modeStyle);
    }
    const base = `#wish-rp-root .m3-dialog[data-dlg="${id}"]`;
    const title = `${base} .m3-sheet>header .m3-t>b:not([data-wish-cloud-title]){display:none!important}`;
    const firebase = '[data-wish-fbp-cloud],[data-wish-fbp-settings]';
    const drive = '[data-wish-drive-cloud],[data-wish-drive-settings]';
    const hide = names => names.split(',').map(name => `${base} ${name}{display:none!important}`).join('');
    const show = names => names.split(',').map(name => `${base} ${name}{display:block!important}`).join('');
    const rules = cloudProvider === 'firebase'
      ? `${title}${base} .m3-dialog-body>*:not([data-wish-fbp-cloud]):not([data-wish-fbp-settings]){display:none!important}${base} .m3-sheet>footer{display:none!important}${show(firebase)}${hide(drive)}`
      : cloudProvider === 'drive'
        ? `${title}${base} .m3-dialog-body>*:not([data-wish-drive-cloud]):not([data-wish-drive-settings]){display:none!important}${base} .m3-sheet>footer{display:none!important}${show(drive)}${hide(firebase)}`
        : `${title}${hide(`${firebase},${drive}`)}`;
    if (modeStyle.textContent !== rules) modeStyle.textContent = rules;
  }
  function injectCloudProvider(dialog) {
    const body = dialog.querySelector('.m3-dialog-body');
    const header = dialog.querySelector('.m3-sheet>header .m3-t');
    if (!body || !header || !body.querySelector('[data-key="cloud-head"]')) return;
    if (!header.querySelector('[data-wish-cloud-providers]')) {
      const title = header.querySelector('b');
      if (title) {
        const patchTitle = document.createElement('b');
        patchTitle.setAttribute('data-fx-node', '');
        patchTitle.setAttribute('data-wish-cloud-title', '');
        patchTitle.textContent = '클라우드 백업';
        title.insertAdjacentElement('afterend', patchTitle);
      }
      const tabs = document.createElement('div');
      tabs.className = 'wish-fbp-providers m3-row';
      tabs.setAttribute('data-wish-cloud-providers', '');
      tabs.setAttribute('data-fx-node', '');
      tabs.innerHTML = '<button type="button" class="m3-btn mini" data-wish-provider="koofr">Koofr</button><button type="button" class="m3-btn mini" data-wish-provider="firebase">Firebase</button><button type="button" class="m3-btn mini" data-wish-provider="drive">Google Drive</button>';
      header.appendChild(tabs);
      for (const button of tabs.querySelectorAll('button')) button.onclick = event => {
        event.preventDefault(); event.stopPropagation();
        cloudProvider = button.dataset.wishProvider;
        gmWrite(CLOUD_PROVIDER_KEY, cloudProvider);
        injectCloudProvider(dialog);
      };
      const panel = document.createElement('div');
      panel.setAttribute('data-wish-fbp-cloud', '');
      panel.setAttribute('data-fx-node', '');
      body.appendChild(panel);
      injectApiSettings(dialog);
      const drivePanel = document.createElement('div');
      drivePanel.setAttribute('data-wish-drive-cloud', '');
      drivePanel.setAttribute('data-fx-node', '');
      body.appendChild(drivePanel);
      injectDriveSettings(dialog);
    }
    const providerChanged = dialog.dataset.wishCloudProvider !== cloudProvider;
    updateCloudModeStyle(dialog);
    dialog.querySelectorAll('[data-wish-provider]').forEach(button => {
      const chosen = button.dataset.wishProvider === cloudProvider;
      button.classList.toggle('primary', chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    if (cloudProvider === 'firebase') {
      if (providerChanged || !dialog.querySelector('[data-wish-fbp-cloud]')?.firstElementChild) renderFirebaseCloudPanel(dialog);
      if (!firebaseAutoListed.has(dialog) && connected()) {
        firebaseAutoListed.add(dialog);
        void refreshFirebaseCloud();
      }
    }
    if (cloudProvider === 'drive') {
      if (!driveScriptPrepared.has(dialog)) {
        driveScriptPrepared.add(dialog);
        void loadDriveIdentityScript().catch(error => {
          const section = dialog.querySelector('[data-wish-drive-settings]');
          const target = section?.querySelector('[data-drive-status]');
          if (target && target.textContent !== error.message) { target.textContent = error.message; target.className = 'wish-fbp-status error'; }
        });
      }
      if (providerChanged || !dialog.querySelector('[data-wish-drive-cloud]')?.firstElementChild) renderDriveCloudPanel(dialog);
      if (!driveAutoListed.has(dialog) && driveConnected()) {
        driveAutoListed.add(dialog);
        void refreshDriveCloud();
      }
    }
    dialog.dataset.wishCloudProvider = cloudProvider;
  }
  function injectPatchVersion(root) {
    const line = root.querySelector('.m3-sub-line');
    if (!line) return;
    const version = [...line.querySelectorAll('span')].find(span => /^Wish Core 1\.5\.3$/.test(span.textContent.trim()));
    if (!version) return;
    const existing = line.querySelector('[data-wish-patch-version]');
    if (existing) {
      if (existing.dataset.wishPatchVersion !== PATCH_VERSION) {
        existing.dataset.wishPatchVersion = PATCH_VERSION;
        existing.textContent = `( + patch ${PATCH_VERSION})`;
      }
      return;
    }
    const badge = document.createElement('span');
    badge.setAttribute('data-fx-node', '');
    badge.dataset.wishPatchVersion = PATCH_VERSION;
    badge.textContent = `( + patch ${PATCH_VERSION})`;
    version.insertAdjacentElement('afterend', badge);
  }
  function applyButtonContrast(button, background, border) {
    if (!button) return;
    button.style.setProperty('background', background, 'important');
    button.style.setProperty('background-color', background, 'important');
    button.style.setProperty('border-color', border, 'important');
    button.style.setProperty('color', '#ffffff', 'important');
    button.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
  }
  function refreshButtonContrast(root) {
    root.querySelectorAll('[data-wish-fbp-upload],[data-wish-fbp-list]').forEach(button => applyButtonContrast(button, '#285d73', '#173c4d'));
    root.querySelectorAll('[data-wish-gpt-final]').forEach(button => applyButtonContrast(button, '#334894', '#263b80'));
  }
  function scan() {
    scanQueued = false;
    const root = document.getElementById('wish-rp-root');
    if (!root) return;
    const version = coreVersion();
    if (version && version !== SUPPORTED_CORE_VERSION) {
      if (!coreMismatchNotified) {
        coreMismatchNotified = true;
        notify(`Cloud Patch v${PATCH_VERSION}는 Wish Core ${SUPPORTED_CORE_VERSION}용입니다. 현재 ${version}에서는 실행하지 않습니다. 패치 업데이트를 확인해 주세요.`, 'warn', 9000);
      }
      return;
    }
    injectPatchVersion(root);
    root.querySelectorAll('.m3-dialog').forEach(injectCloudProvider);
    root.querySelectorAll('.m3-dialog').forEach(injectFinalGptButton);
    refreshButtonContrast(root);
  }
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }
  function installObserver() {
    if (!document.documentElement) { document.addEventListener('DOMContentLoaded', installObserver, { once:true }); return; }
    new MutationObserver(queueScan).observe(document.documentElement, { childList:true, subtree:true });
    queueScan();
    const notice = sessionStorage.getItem(RESTORE_NOTICE_KEY);
    if (notice) { sessionStorage.removeItem(RESTORE_NOTICE_KEY); setTimeout(() => notify(notice, 'success', 6500), 1200); }
  }

  const style = document.createElement('style');
  style.id = 'wish-fbp-style';
  style.textContent = `
    #wish-fbp-toast-wrap{position:fixed;z-index:2147483647;right:14px;bottom:16px;display:flex;flex-direction:column;gap:8px;max-width:min(430px,calc(100vw - 28px));pointer-events:none}
    .wish-fbp-toast{opacity:0;transform:translateY(8px);padding:11px 14px;border:1px solid #46566f;border-radius:10px;background:#17202d;color:#e8eef8;box-shadow:0 14px 40px #0009;font:12px/1.55 system-ui,sans-serif;transition:.2s}.wish-fbp-toast.show{opacity:1;transform:none}.wish-fbp-toast.success{border-color:#3d7b65;color:#b9f0d7}.wish-fbp-toast.error{border-color:#8f4653;color:#ffc3cb}.wish-fbp-toast.warn{border-color:#8c6c35;color:#ffe0a8}
    .wish-fbp-settings>label,.wish-fbp-settings .wish-fbp-grid>label{display:grid;gap:5px;margin:9px 0;color:var(--m3-fg2,#c8d0df);font-size:11px}.wish-fbp-settings label>span{font-weight:650}.wish-fbp-settings input{box-sizing:border-box;width:100%;min-height:38px;border:1px solid var(--m3-line,#3a465a);border-radius:8px;background:var(--m3-card2,#111824);color:var(--m3-fg,#edf1f8);padding:8px 10px;font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}.wish-fbp-settings input:focus{outline:2px solid color-mix(in srgb,var(--m3-accent,#83aaff) 28%,transparent);border-color:var(--m3-accent,#83aaff)}.wish-fbp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wish-fbp-status{margin-top:10px;padding:9px 11px;border-radius:8px;background:var(--m3-card2,#111824);color:var(--m3-fg2,#c8d0df);font-size:11px;line-height:1.55}.wish-fbp-status.ok{color:#93dfbd}.wish-fbp-status.error{color:#ff9eab}.wish-fbp-status.busy{color:#ffd58f}.wish-fbp-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.wish-fbp-main-button{border-color:#173c4d!important;background:#285d73!important;color:#fff!important;font-weight:760!important;box-shadow:0 2px 7px rgba(20,63,82,.25)!important}.wish-fbp-main-button:hover{border-color:#102f3d!important;background:#1d4d62!important;color:#fff!important}.wish-gpt-prepare-button{border-color:color-mix(in srgb,var(--m3-accent,#3f52a0) 70%,#18213a)!important;background:var(--m3-accent,#3f52a0)!important;color:var(--m3-accent-ink,#fff)!important;font-weight:720!important}.wish-gpt-prepare-button:hover{filter:brightness(.92)}
    .wish-gpt-transfer-note{margin-top:12px;padding:9px 11px;border:1px solid color-mix(in srgb,var(--m3-accent,#83aaff) 35%,transparent);border-radius:9px;background:color-mix(in srgb,var(--m3-accent,#83aaff) 9%,transparent);color:var(--m3-fg2,#c8d0df);font-size:11px;line-height:1.55}
    .wish-fbp-providers{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.wish-fbp-providers .m3-btn{min-width:76px;font-weight:750!important}.wish-fbp-providers [aria-pressed="true"]{background:#315999!important;border-color:#254579!important;color:#fff!important;-webkit-text-fill-color:#fff!important}.wish-fbp-providers [aria-pressed="false"]{background:#dce3ef!important;border-color:#a5b4ce!important;color:#24344f!important;-webkit-text-fill-color:#24344f!important}body[data-theme="dark"] .wish-fbp-providers [aria-pressed="false"]{background:#303b50!important;border-color:#50617e!important;color:#ecf2ff!important;-webkit-text-fill-color:#ecf2ff!important}
    .wish-fbp-providers [aria-pressed="true"]::before{content:"✓";margin-right:4px}.wish-cloud-choice .m3-cloud-info{cursor:pointer!important}.wish-cloud-choice .m3-cloud-info .m3-box{visibility:visible!important;flex:none}.wish-cloud-choice.is-selected{border:2px solid #245bb0!important;background:#e5f0ff!important;box-shadow:inset 4px 0 #245bb0,0 0 0 1px #93b8ef!important}.wish-cloud-choice.is-selected .m3-t b{color:#173d78!important}.wish-cloud-choice.is-selected .m3-t small{color:#335477!important}.wish-cloud-selected{display:inline-flex;align-items:center;white-space:nowrap;margin-left:6px;padding:2px 7px;border-radius:99px;background:#245bb0;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:10px;font-style:normal;font-weight:800;line-height:1.4}body[data-theme="dark"] .wish-cloud-choice.is-selected{border-color:#8bb7ff!important;background:#203657!important;box-shadow:inset 4px 0 #8bb7ff,0 0 0 1px #5284c8!important}body[data-theme="dark"] .wish-cloud-choice.is-selected .m3-t b{color:#f3f7ff!important}body[data-theme="dark"] .wish-cloud-choice.is-selected .m3-t small{color:#c4d8f5!important}body[data-theme="dark"] .wish-cloud-selected{background:#a9caff;color:#14243b!important;-webkit-text-fill-color:#14243b!important}
    @media(max-width:600px){.m3-cloud-row.wish-cloud-choice{display:grid!important;grid-template-columns:minmax(0,1fr)!important}.wish-cloud-choice .m3-cloud-info{width:100%}.wish-cloud-choice .m3-cloud-actions{width:100%;justify-content:flex-end}}
    .m3-dialog.wish-fbp-firebase-mode .m3-dialog-body>*:not([data-wish-fbp-cloud]):not([data-wish-fbp-settings]),.m3-dialog.wish-fbp-drive-mode .m3-dialog-body>*:not([data-wish-drive-cloud]):not([data-wish-drive-settings]){display:none!important}.m3-dialog.wish-fbp-firebase-mode .m3-sheet>footer,.m3-dialog.wish-fbp-drive-mode .m3-sheet>footer{display:none!important}.m3-dialog:not(.wish-fbp-firebase-mode) [data-wish-fbp-cloud],.m3-dialog:not(.wish-fbp-firebase-mode) [data-wish-fbp-settings],.m3-dialog:not(.wish-fbp-drive-mode) [data-wish-drive-cloud],.m3-dialog:not(.wish-fbp-drive-mode) [data-wish-drive-settings]{display:none!important}[data-wish-fbp-cloud] .m3-cloud-row,[data-wish-drive-cloud] .m3-cloud-row{display:flex;align-items:center;justify-content:space-between;gap:10px}[data-wish-fbp-cloud] .m3-cloud-info,[data-wish-drive-cloud] .m3-cloud-info{min-width:0;flex:1}[data-wish-fbp-cloud] .m3-cloud-actions,[data-wish-drive-cloud] .m3-cloud-actions{flex:none}[data-wish-fbp-cloud] .m3-btn.primary,[data-wish-fbp-settings] .m3-btn.primary,[data-wish-drive-cloud] .m3-btn.primary,[data-wish-drive-settings] .m3-btn.primary{background:#315999!important;border-color:#254579!important;color:#fff!important;-webkit-text-fill-color:#fff!important}.wish-drive-help{margin:8px 0 12px;color:var(--m3-fg2,#c8d0df);font-size:11px}.wish-drive-help summary{display:inline-grid;place-items:center;width:22px;height:22px;border:1px solid var(--m3-line,#60718f);border-radius:50%;cursor:pointer;font-weight:800;list-style:none}.wish-drive-help summary::-webkit-details-marker{display:none}.wish-drive-help>div{margin-top:7px;line-height:1.7;overflow-wrap:anywhere}.wish-drive-help a{color:var(--m3-accent,#5890df);text-decoration:underline}.wish-drive-help code{overflow-wrap:anywhere}
    .wish-fbp-overlay{position:fixed;z-index:2147483646;inset:0;display:grid;place-items:center;padding:16px;background:#080b11c7;backdrop-filter:blur(5px);font:12px/1.5 system-ui,sans-serif;color:#edf1f8}.wish-fbp-modal{width:min(640px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border:1px solid #354258;border-radius:14px;background:#141b27;box-shadow:0 28px 80px #000c;overflow:hidden}.wish-fbp-modal>header{display:flex;align-items:flex-start;gap:12px;padding:16px 18px;border-bottom:1px solid #2b3547}.wish-fbp-modal>header>div{flex:1}.wish-fbp-modal>header b{display:block;font-size:16px}.wish-fbp-modal>header small{display:block;margin-top:3px;color:#94a1b6}.wish-fbp-modal>header button{border:0;background:none;color:#aab5c7;font-size:18px;cursor:pointer}.wish-fbp-body{min-height:0;overflow:auto;padding:14px 18px}.wish-fbp-modal>footer{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #2b3547;background:#101722}.wish-fbp-modal>footer>span{flex:1}.wish-fbp-modal button,.wish-fbp-toolbar button{border:1px solid #3b485e;border-radius:8px;background:#202a3a;color:#dbe3ef;padding:8px 11px;cursor:pointer;font:inherit}.wish-fbp-modal button:hover{border-color:#60789e}.wish-fbp-modal button:disabled{opacity:.45;cursor:default}.wish-fbp-modal button.primary{border-color:#557bc0;background:#294979;color:#fff}.wish-fbp-modal button.danger{border-color:#75434c;background:#3a2228;color:#ffc2cb}.wish-fbp-row{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;margin:7px 0;padding:11px 12px;border:1px solid #303b4d;border-radius:10px;background:#18212e;cursor:pointer}.wish-fbp-row:hover{border-color:#50647f}.wish-fbp-row.blocked{opacity:.55;cursor:not-allowed}.wish-fbp-row input{margin-top:3px;accent-color:#719be1}.wish-fbp-row span{min-width:0}.wish-fbp-row b,.wish-fbp-row small{display:block;overflow-wrap:anywhere}.wish-fbp-row small{margin-top:3px;color:#93a0b3}.wish-fbp-body h3{margin:18px 0 8px;color:#b7c5d9;font-size:12px}.wish-fbp-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:12px}.wish-fbp-toolbar span{margin-left:auto;color:#9eabbd}.wish-fbp-note{margin-top:14px;padding:10px 12px;border:1px solid #5b4e33;border-radius:9px;background:#282316;color:#d9c28c}.wish-fbp-empty{padding:30px 12px;text-align:center;color:#8996aa}
    #wish-gpt-transfer-widget{position:fixed;z-index:2147483645;right:18px;bottom:92px;display:grid;grid-template-columns:minmax(180px,auto) auto auto;align-items:stretch;gap:5px;max-width:calc(100vw - 28px);padding:6px;border:1px solid #526786;border-radius:14px;background:#151d29eF;box-shadow:0 16px 48px #0008;backdrop-filter:blur(12px);font:12px/1.35 system-ui,sans-serif;color:#eef4ff}#wish-gpt-transfer-widget button{border:1px solid #40516b;border-radius:9px;background:#212d40;color:#e8f0fd;padding:8px 10px;cursor:pointer;font:inherit}#wish-gpt-transfer-widget button:hover{border-color:#7ca2df;background:#293954}#wish-gpt-transfer-widget button:disabled{opacity:.6;cursor:wait}.wish-gpt-send{display:grid;text-align:left}.wish-gpt-send b{font-size:12px}.wish-gpt-send small{margin-top:2px;color:#a9b7ca;font-size:10px}.wish-gpt-save,.wish-gpt-clear{min-width:42px}.wish-gpt-clear{font-size:18px!important;padding-inline:9px!important}.wish-gpt-bridge-page #wish-fbp-toast-wrap{bottom:168px}
    @media(max-width:600px){.wish-fbp-grid{grid-template-columns:1fr}.wish-fbp-overlay{padding:0;place-items:end stretch}.wish-fbp-modal{width:100%;max-height:88vh;border-radius:16px 16px 0 0}.wish-fbp-modal>footer{flex-wrap:wrap}.wish-fbp-modal>footer>span{display:none}.wish-fbp-modal>footer button{flex:1}.wish-fbp-toolbar span{flex-basis:100%;margin-left:0}}
    @media(max-width:600px){#wish-gpt-transfer-widget{left:10px;right:10px;bottom:76px;grid-template-columns:minmax(0,1fr) auto auto}.wish-gpt-bridge-page #wish-fbp-toast-wrap{bottom:154px}}
    .wish-inc-field{display:grid;gap:5px;margin:13px 0;color:#dbe3ef}.wish-inc-field>span{font-weight:700}.wish-inc-field>small{color:#a7b4c8}.wish-inc-field input,.wish-inc-field textarea{box-sizing:border-box;width:100%;border:1px solid #465773;border-radius:8px;background:#101a29;color:#f1f5ff;padding:9px 10px;font:12px/1.5 system-ui,sans-serif}.wish-inc-field textarea{resize:vertical;max-height:240px}
    #wish-gpt-transfer-widget{display:flex;flex-wrap:wrap}#wish-gpt-transfer-widget .wish-gpt-send{flex:1 1 170px}#wish-gpt-transfer-widget .wish-gpt-checkpoint{flex:0 1 auto;white-space:normal}
    @media(max-width:600px){#wish-gpt-transfer-widget{bottom:calc(76px + env(safe-area-inset-bottom,0px))}.wish-gpt-bridge-page #wish-fbp-toast-wrap{bottom:calc(154px + env(safe-area-inset-bottom,0px))}.wish-fbp-overlay{padding-bottom:env(safe-area-inset-bottom,0px)}}
  `;
  function mountStyle() {
    const target = document.head || document.documentElement;
    if (target) { target.appendChild(style); return; }
    document.addEventListener('DOMContentLoaded', () => (document.head || document.documentElement)?.appendChild(style), { once:true });
  }
  mountStyle();
  if (IS_CHATGPT) installChatGPTBridge();
  else {
    installSecondaryDownloadCapture();
    installObserver();
  }
})();
