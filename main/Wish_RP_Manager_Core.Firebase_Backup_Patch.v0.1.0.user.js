// ==UserScript==
// @name         🪽 Wish RP Manager Core · Firebase Backup Patch
// @namespace    local.rp.context.manager.firebase.backup.patch
// @version      0.1.0
// @description  Wish RP Manager Core v1.0.6에 Firebase 전체 백업 업로드·목록·복원·삭제를 추가하는 동반 패치입니다.
// @author       User
// @license      All Rights Reserved
// @match        https://crack.wrtn.ai/stories/*/episodes/*
// @match        https://crack.wrtn.ai/characters/*/chats/*
// @match        https://crack.wrtn.ai/u/*/c/*
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// @connect      *.firebaseio.com
// @connect      *.firebasedatabase.app
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const PATCH_VERSION = '0.1.0';
  const CORE_RUNTIME_KEY = '__WISH_RP_MANAGER_V1__';
  const DB_NAME = 'WishRPManagerDB_v2';
  const STORES = ['rooms', 'characterLibraries', 'cognitionRooms', 'runtime', 'autoHistory'];
  const SETTINGS_KEY = 'WISH_RP_FIREBASE_PATCH_SETTINGS_V1';
  const SESSION_KEY = 'WISH_RP_FIREBASE_PATCH_SESSION_V1';
  const RESTORE_NOTICE_KEY = 'WISH_RP_FIREBASE_PATCH_RESTORED_V1';
  const DEFAULTS = Object.freeze({
    apiKey: 'AIza------',
    databaseURL: 'https://----.firebaseio.com',
    email: '-----',
  });
  const META_ROOT = 'rpManagerBackupMeta';
  const DATA_ROOT = 'rpManagerBackupData';
  const MANAGER_ID = 'wish-rp-manager-core';
  const GUIDE_BASE_VERSION = '1.5.0';
  const GUIDE_STORAGE_KEYS = Object.freeze({
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
    currentState:'WISH_RP_api_guide_currentState_v1',
    logSummary:'WISH_RP_api_guide_logSummary_v1',
    loreAuto:'WISH_RP_guide_lore_auto_v1',
    loreExternal:'WISH_RP_guide_lore_external_v1',
  });
  const DEFAULT_EXTRA_PRESET_KEY = 'WISH_RP_default_extra_preset_v1';

  let busy = false;
  let scanQueued = false;
  const apiDrafts = new Map();

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
    if (!session) throw new Error('Firebase 로그인이 필요합니다. API 설정의 Firebase 서버 백업에서 먼저 연결해 주세요.');
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
      document.querySelector('#wish-rp-root [data-act="api"]')?.click();
      throw new Error('API 설정의 Firebase 서버 백업에서 비밀번호를 입력하고 연결해 주세요.');
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
        version:String(runtime()?.version || '1.0.6'),
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
        next.pending = null;
        delete next.lastVerifiedInjectionAt;
        next._epoch = crypto.randomUUID ? crypto.randomUUID() : `restore-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        next._rev = Number(old?._rev || 0) + 1;
        return next;
      });
      const apiIds = new Set(rooms.map(apiChatIdOf).filter(Boolean).map(String));
      const cognitionById = new Map((data.cognitionRooms || []).filter(item => apiIds.has(String(item?.id || ''))).map(item => [String(item.id), item]));
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
              next.scanJob = null;
              next.automation = null;
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
      try { await bridge()?.refresh?.(); } catch (_) {}
      return { rooms:rooms.length, libraries:libraries.length, cognition:cognitionById.size, settings:!!restoreSettings };
    } finally { db.close(); }
  }

  async function uploadBackup() {
    if (busy) return;
    const label = prompt('서버 백업 이름을 입력하세요.', `Wish 전체 백업 ${new Date().toLocaleString('ko-KR')}`);
    if (label === null) return;
    busy = true;
    try {
      const ready = await ensureReady();
      notify('전체 백업을 구성해 Firebase에 올리는 중…', 'info', 2600);
      const payload = await createCoreBackup();
      const id = `W${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const meta = {
        id,
        manager:MANAGER_ID,
        source:'companion-patch',
        label:String(label || '').trim().slice(0, 80) || `Wish 전체 백업 ${new Date().toLocaleString('ko-KR')}`,
        createdAt:payload.exportedAt,
        version:String(payload.version || '1.0.6'),
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
    const id = String(dialog.dataset.dlg || 'api');
    const saved = loadSettings();
    const draft = apiDrafts.get(id) || { ...saved, password:'' };
    apiDrafts.set(id, draft);
    const section = document.createElement('section');
    section.className = 'm3-grp wish-fbp-settings';
    section.setAttribute('data-wish-fbp-settings', '');
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
  function injectBackupButtons(root) {
    const actions = root.querySelector('[data-key="backup"] .m3-card-actions');
    if (!actions || actions.querySelector('[data-wish-fbp-upload]')) return;
    const upload = document.createElement('button');
    upload.type = 'button';
    upload.className = 'm3-btn mini wish-fbp-main-button';
    upload.setAttribute('data-wish-fbp-upload', '');
    upload.textContent = '☁ 서버에 올리기';
    upload.onclick = uploadBackup;
    const list = document.createElement('button');
    list.type = 'button';
    list.className = 'm3-btn mini wish-fbp-main-button';
    list.setAttribute('data-wish-fbp-list', '');
    list.textContent = '☁ 서버 백업 목록';
    list.onclick = openBackupList;
    actions.append(upload, list);
  }
  function scan() {
    scanQueued = false;
    const root = document.getElementById('wish-rp-root');
    if (!root) return;
    injectBackupButtons(root);
    root.querySelectorAll('.m3-dialog[aria-label="보조 AI 연결"]').forEach(injectApiSettings);
  }
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }
  function installObserver() {
    if (!document.documentElement) { document.addEventListener('DOMContentLoaded', installObserver, { once:true }); return; }
    new MutationObserver(queueScan).observe(document.documentElement, { childList:true, subtree:true });
    document.addEventListener('click', event => {
      const save = event.target.closest?.('[data-act="aiSave"]');
      if (!save) return;
      const section = save.closest('.m3-dialog')?.querySelector('[data-wish-fbp-settings]');
      if (!section) return;
      try { saveSettings(readSectionSettings(section)); }
      catch (error) { event.preventDefault(); event.stopImmediatePropagation(); notify(`서버 백업 설정 확인: ${error.message}`, 'error', 6500); }
    }, true);
    queueScan();
    const notice = sessionStorage.getItem(RESTORE_NOTICE_KEY);
    if (notice) { sessionStorage.removeItem(RESTORE_NOTICE_KEY); setTimeout(() => notify(notice, 'success', 6500), 1200); }
  }

  const style = document.createElement('style');
  style.id = 'wish-fbp-style';
  style.textContent = `
    #wish-fbp-toast-wrap{position:fixed;z-index:2147483647;right:14px;bottom:16px;display:flex;flex-direction:column;gap:8px;max-width:min(430px,calc(100vw - 28px));pointer-events:none}
    .wish-fbp-toast{opacity:0;transform:translateY(8px);padding:11px 14px;border:1px solid #46566f;border-radius:10px;background:#17202d;color:#e8eef8;box-shadow:0 14px 40px #0009;font:12px/1.55 system-ui,sans-serif;transition:.2s}.wish-fbp-toast.show{opacity:1;transform:none}.wish-fbp-toast.success{border-color:#3d7b65;color:#b9f0d7}.wish-fbp-toast.error{border-color:#8f4653;color:#ffc3cb}.wish-fbp-toast.warn{border-color:#8c6c35;color:#ffe0a8}
    .wish-fbp-settings>label,.wish-fbp-settings .wish-fbp-grid>label{display:grid;gap:5px;margin:9px 0;color:var(--m3-fg2,#c8d0df);font-size:11px}.wish-fbp-settings label>span{font-weight:650}.wish-fbp-settings input{box-sizing:border-box;width:100%;min-height:38px;border:1px solid var(--m3-line,#3a465a);border-radius:8px;background:var(--m3-card2,#111824);color:var(--m3-fg,#edf1f8);padding:8px 10px;font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}.wish-fbp-settings input:focus{outline:2px solid color-mix(in srgb,var(--m3-accent,#83aaff) 28%,transparent);border-color:var(--m3-accent,#83aaff)}.wish-fbp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wish-fbp-status{margin-top:10px;padding:9px 11px;border-radius:8px;background:var(--m3-card2,#111824);color:var(--m3-fg2,#c8d0df);font-size:11px;line-height:1.55}.wish-fbp-status.ok{color:#93dfbd}.wish-fbp-status.error{color:#ff9eab}.wish-fbp-status.busy{color:#ffd58f}.wish-fbp-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.wish-fbp-main-button{border-color:#3e6473!important;color:#bce8f1!important}
    .wish-fbp-overlay{position:fixed;z-index:2147483646;inset:0;display:grid;place-items:center;padding:16px;background:#080b11c7;backdrop-filter:blur(5px);font:12px/1.5 system-ui,sans-serif;color:#edf1f8}.wish-fbp-modal{width:min(640px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border:1px solid #354258;border-radius:14px;background:#141b27;box-shadow:0 28px 80px #000c;overflow:hidden}.wish-fbp-modal>header{display:flex;align-items:flex-start;gap:12px;padding:16px 18px;border-bottom:1px solid #2b3547}.wish-fbp-modal>header>div{flex:1}.wish-fbp-modal>header b{display:block;font-size:16px}.wish-fbp-modal>header small{display:block;margin-top:3px;color:#94a1b6}.wish-fbp-modal>header button{border:0;background:none;color:#aab5c7;font-size:18px;cursor:pointer}.wish-fbp-body{min-height:0;overflow:auto;padding:14px 18px}.wish-fbp-modal>footer{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #2b3547;background:#101722}.wish-fbp-modal>footer>span{flex:1}.wish-fbp-modal button,.wish-fbp-toolbar button{border:1px solid #3b485e;border-radius:8px;background:#202a3a;color:#dbe3ef;padding:8px 11px;cursor:pointer;font:inherit}.wish-fbp-modal button:hover{border-color:#60789e}.wish-fbp-modal button:disabled{opacity:.45;cursor:default}.wish-fbp-modal button.primary{border-color:#557bc0;background:#294979;color:#fff}.wish-fbp-modal button.danger{border-color:#75434c;background:#3a2228;color:#ffc2cb}.wish-fbp-row{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;margin:7px 0;padding:11px 12px;border:1px solid #303b4d;border-radius:10px;background:#18212e;cursor:pointer}.wish-fbp-row:hover{border-color:#50647f}.wish-fbp-row.blocked{opacity:.55;cursor:not-allowed}.wish-fbp-row input{margin-top:3px;accent-color:#719be1}.wish-fbp-row span{min-width:0}.wish-fbp-row b,.wish-fbp-row small{display:block;overflow-wrap:anywhere}.wish-fbp-row small{margin-top:3px;color:#93a0b3}.wish-fbp-body h3{margin:18px 0 8px;color:#b7c5d9;font-size:12px}.wish-fbp-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:12px}.wish-fbp-toolbar span{margin-left:auto;color:#9eabbd}.wish-fbp-note{margin-top:14px;padding:10px 12px;border:1px solid #5b4e33;border-radius:9px;background:#282316;color:#d9c28c}.wish-fbp-empty{padding:30px 12px;text-align:center;color:#8996aa}
    @media(max-width:600px){.wish-fbp-grid{grid-template-columns:1fr}.wish-fbp-overlay{padding:0;place-items:end stretch}.wish-fbp-modal{width:100%;max-height:88vh;border-radius:16px 16px 0 0}.wish-fbp-modal>footer{flex-wrap:wrap}.wish-fbp-modal>footer>span{display:none}.wish-fbp-modal>footer button{flex:1}.wish-fbp-toolbar span{flex-basis:100%;margin-left:0}}
  `;
  function mountStyle() {
    const target = document.head || document.documentElement;
    if (target) { target.appendChild(style); return; }
    document.addEventListener('DOMContentLoaded', () => (document.head || document.documentElement)?.appendChild(style), { once:true });
  }
  mountStyle();
  installObserver();
})();
