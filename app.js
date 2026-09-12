const $ = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  platform: 'kakao',
  messages: [],
  originals: [],
  avatars: { A: '', B: '' },
  currentLang: 'ko',
  authToken: sessionStorage.getItem('chatCaptureAuthToken') || '',
  authExpiresAt: Number(sessionStorage.getItem('chatCaptureAuthExpiresAt') || 0),
};

const els = {
  platformPicker: $('platformPicker'), chatTitle: $('chatTitle'), chatDate: $('chatDate'), startTime: $('startTime'),
  toneSelect: $('toneSelect'), nameA: $('nameA'), nameB: $('nameB'), contextHint: $('contextHint'),
  rawConversation: $('rawConversation'), messageEditor: $('messageEditor'), messageCount: $('messageCount'),
  previewTitle: $('previewTitle'), platformLabel: $('platformLabel'), dateSeparator: $('dateSeparator'),
  messageList: $('messageList'), captureTarget: $('captureTarget'), chatScroll: $('chatScroll'),
  statusTime: $('statusTime'), mockupToggle: $('mockupToggle'), mockupMark: $('mockupMark'),
  readReceiptToggle: $('readReceiptToggle'), apiDialog: $('apiDialog'), gasUrl: $('gasUrl'), appPassword: $('appPassword'),
  apiStatus: $('apiStatus'), connectionPill: $('connectionPill'), toast: $('toast'), headerAvatar: $('headerAvatar'),
  headerAvatarFallback: $('headerAvatarFallback'), headerProfile: $('headerProfile')
};

const platformNames = { kakao: 'KakaoTalk', wechat: 'WeChat', whatsapp: 'WhatsApp', telegram: 'Telegram' };
const platformPlaceholders = { kakao: '메시지 입력', wechat: 'Message', whatsapp: 'Type a message', telegram: 'Message' };
const languageNames = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文' };

function pad(n) { return String(n).padStart(2, '0'); }
function localDateValue(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function localTimeValue(d = new Date()) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function clampText(v, n = 5000) { return String(v ?? '').slice(0, n); }

function initDefaults() {
  els.chatDate.value = localDateValue();
  els.startTime.value = localTimeValue();
  els.gasUrl.value = localStorage.getItem('chatCaptureGasUrl') || '';
  validateStoredSession();
  parseConversation(false);
  bindEvents();
  renderAll();
  updateApiStatus();
}

function bindEvents() {
  els.platformPicker.addEventListener('click', (e) => {
    const card = e.target.closest('[data-platform]');
    if (!card) return;
    state.platform = card.dataset.platform;
    qsa('.platform-card').forEach((x) => x.classList.toggle('active', x === card));
    renderPreview();
  });

  ['chatTitle', 'chatDate', 'startTime', 'nameA', 'nameB', 'toneSelect', 'contextHint'].forEach((id) => {
    $(id).addEventListener('input', () => {
      regenerateTimes();
      renderAll();
    });
  });

  els.mockupToggle.addEventListener('change', renderPreview);
  els.readReceiptToggle.addEventListener('change', renderPreview);
  $('parseBtn').addEventListener('click', () => parseConversation(true));
  $('addMessageBtn').addEventListener('click', addMessage);
  $('resetBtn').addEventListener('click', resetApp);
  $('saveDraftBtn').addEventListener('click', saveDraft);
  $('loadDraftBtn').addEventListener('click', loadDraft);
  $('captureScreenBtn').addEventListener('click', () => downloadCapture(false));
  $('captureFullBtn').addEventListener('click', () => downloadCapture(true));
  $('apiSettingsBtn').addEventListener('click', openApiDialog);
  $('connectApiBtn').addEventListener('click', connectApi);
  $('disconnectApiBtn').addEventListener('click', disconnectApi);
  qsa('[data-lang]').forEach((btn) => btn.addEventListener('click', () => handleLanguage(btn.dataset.lang)));
  qsa('[data-ai="naturalize"]').forEach((btn) => btn.addEventListener('click', () => runAi('naturalize', state.currentLang)));
  $('avatarA').addEventListener('change', (e) => loadAvatar(e, 'A'));
  $('avatarB').addEventListener('change', (e) => loadAvatar(e, 'B'));
  window.addEventListener('storage', (e) => {
    if (e.key === 'chatCaptureGasUrl') {
      els.gasUrl.value = e.newValue || '';
      updateApiStatus();
    }
  });
}

function parseConversation(notify = true) {
  const lines = els.rawConversation.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const parsed = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^([AB])\s*[:：]\s*(.*)$/i);
    if (match) {
      current = { speaker: match[1].toUpperCase(), text: clampText(match[2]), original: clampText(match[2]), time: '' };
      parsed.push(current);
    } else if (current) {
      current.text = clampText(`${current.text}\n${line}`);
      current.original = clampText(`${current.original}\n${line}`);
    }
  }

  if (!parsed.length) {
    if (notify) showToast('A: / B: 형식의 대화를 입력해 주세요.');
    return;
  }

  state.messages = parsed;
  state.originals = parsed.map((m) => ({ ...m }));
  state.currentLang = 'ko';
  regenerateTimes();
  renderAll();
  if (notify) showToast(`${parsed.length}개 메시지를 적용했습니다.`);
}

function addMessage() {
  const speaker = state.messages.at(-1)?.speaker === 'A' ? 'B' : 'A';
  state.messages.push({ speaker, text: '새 메시지', original: '새 메시지', time: '' });
  state.originals = state.messages.map((m) => ({ ...m, text: m.original || m.text }));
  regenerateTimes();
  renderAll();
  requestAnimationFrame(() => els.messageEditor.scrollTo({ top: els.messageEditor.scrollHeight, behavior: 'smooth' }));
}

function regenerateTimes() {
  if (!state.messages.length) return;
  const [h, m] = (els.startTime.value || '09:00').split(':').map(Number);
  let cursor = (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);

  state.messages.forEach((msg, i) => {
    if (i > 0) {
      const previousLength = state.messages[i - 1].text.length;
      const semanticPause = previousLength > 80 ? 2 : previousLength > 35 ? 1 : 0;
      const alternatingPause = (i * 7 + previousLength) % 4 === 0 ? 1 : 0;
      cursor += 1 + Math.min(semanticPause + alternatingPause, 3);
    }
    msg.time = `${pad(Math.floor((cursor % 1440) / 60))}:${pad(cursor % 60)}`;
  });

  const finalMinutes = cursor + 1;
  els.statusTime.textContent = `${pad(Math.floor((finalMinutes % 1440) / 60))}:${pad(finalMinutes % 60)}`;
}

function renderAll() {
  els.messageCount.textContent = `${state.messages.length}개`;
  renderMessageEditor();
  renderPreview();
}

function renderMessageEditor() {
  els.messageEditor.innerHTML = '';
  state.messages.forEach((msg, index) => {
    const row = document.createElement('div');
    row.className = 'message-edit-row';

    const toggle = document.createElement('button');
    toggle.className = `speaker-toggle speaker-${msg.speaker.toLowerCase()}`;
    toggle.textContent = msg.speaker;
    toggle.title = '화자 전환';
    toggle.onclick = () => {
      msg.speaker = msg.speaker === 'A' ? 'B' : 'A';
      if (state.originals[index]) state.originals[index].speaker = msg.speaker;
      renderAll();
    };

    const ta = document.createElement('textarea');
    ta.value = msg.text;
    ta.maxLength = 5000;
    ta.oninput = () => {
      msg.text = ta.value;
      renderPreview();
    };

    const tm = document.createElement('div');
    tm.className = 'auto-time';
    tm.textContent = msg.time;

    const del = document.createElement('button');
    del.className = 'delete-message';
    del.textContent = '×';
    del.title = '삭제';
    del.onclick = () => {
      state.messages.splice(index, 1);
      state.originals.splice(index, 1);
      regenerateTimes();
      renderAll();
    };

    row.append(toggle, ta, tm, del);
    els.messageEditor.append(row);
  });
}

function renderPreview() {
  els.captureTarget.className = `phone platform-${state.platform}`;
  els.previewTitle.textContent = els.chatTitle.value || els.nameB.value || 'Chat';
  els.platformLabel.textContent = platformNames[state.platform];
  els.dateSeparator.textContent = formatDate(els.chatDate.value, state.platform);
  qs('.fake-input', els.captureTarget).textContent = platformPlaceholders[state.platform];
  els.messageList.innerHTML = '';
  renderHeaderAvatar();

  const groupEnds = state.messages.map((m, i) => i === state.messages.length - 1 || state.messages[i + 1].speaker !== m.speaker || state.messages[i + 1].time !== m.time);
  const avatarPlatforms = new Set(['kakao', 'wechat']);

  state.messages.forEach((msg, i) => {
    const mine = msg.speaker === 'A';
    const row = document.createElement('div');
    row.className = `message-row ${mine ? 'mine' : 'theirs'}`;

    const showSideAvatar = !mine && avatarPlatforms.has(state.platform);
    if (showSideAvatar && isFirstOfGroup(i)) row.append(makeAvatar('B'));
    else if (showSideAvatar) {
      const spacer = document.createElement('div');
      spacer.className = 'avatar-spacer';
      row.append(spacer);
    }

    const stack = document.createElement('div');
    stack.className = 'message-stack';

    const showSenderName = !mine && isFirstOfGroup(i) && state.platform === 'kakao';
    if (showSenderName) {
      const sender = document.createElement('div');
      sender.className = 'sender-name';
      sender.textContent = els.nameB.value || 'B';
      stack.append(sender);
    }

    const line = document.createElement('div');
    line.className = 'bubble-line';
    const bubble = document.createElement('div');
    bubble.className = `bubble ${mine ? 'self' : 'other'}`;

    const text = document.createElement('span');
    text.className = 'bubble-text';
    text.textContent = msg.text;
    bubble.append(text);

    const inBubbleMeta = ['whatsapp', 'telegram'].includes(state.platform);
    if (inBubbleMeta && groupEnds[i]) bubble.append(makeMeta(msg, mine));
    line.append(bubble);

    if (!inBubbleMeta && groupEnds[i]) {
      const outsideMeta = makeOutsideMeta(msg, mine);
      line.append(outsideMeta);
    }

    stack.append(line);
    row.append(stack);
    els.messageList.append(row);
  });

  els.mockupMark.style.display = els.mockupToggle.checked ? 'block' : 'none';
}

function makeMeta(msg, mine) {
  const meta = document.createElement('span');
  meta.className = 'bubble-meta';
  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = formatTime(msg.time, state.platform);
  meta.append(time);

  if (mine && els.readReceiptToggle.checked) {
    const receipt = document.createElement('span');
    receipt.className = 'read-receipt';
    receipt.textContent = '✓✓';
    meta.append(receipt);
  }
  return meta;
}

function makeOutsideMeta(msg, mine) {
  const wrap = document.createElement('span');
  wrap.className = 'outside-meta';

  if (mine && els.readReceiptToggle.checked && state.platform === 'kakao') {
    const unread = document.createElement('span');
    unread.className = 'kakao-unread';
    unread.textContent = '1';
    wrap.append(unread);
  }

  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = formatTime(msg.time, state.platform);
  wrap.append(time);
  return wrap;
}

function isFirstOfGroup(i) { return i === 0 || state.messages[i - 1].speaker !== state.messages[i].speaker; }

function makeAvatar(speaker) {
  const d = document.createElement('div');
  d.className = 'msg-avatar';
  if (state.avatars[speaker]) {
    const img = document.createElement('img');
    img.src = state.avatars[speaker];
    img.alt = '';
    img.style.display = 'block';
    d.append(img);
  } else {
    d.textContent = participantInitial(speaker);
  }
  return d;
}

function participantInitial(speaker) {
  const value = speaker === 'A' ? (els.nameA.value || 'A') : (els.nameB.value || 'B');
  return value.trim().slice(0, 1).toUpperCase();
}

function renderHeaderAvatar() {
  const initial = participantInitial('B');
  els.headerAvatarFallback.textContent = initial;
  if (state.avatars.B) {
    els.headerAvatar.src = state.avatars.B;
    els.headerAvatar.style.display = 'block';
    els.headerAvatarFallback.style.display = 'none';
  } else {
    els.headerAvatar.style.display = 'none';
    els.headerAvatarFallback.style.display = 'grid';
  }
}

function formatDate(value, platform) {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00`);
  if (platform === 'kakao') return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(d);
  if (platform === 'wechat') return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
  if (platform === 'whatsapp') return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(d);
}

function formatTime(value, platform) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  if (platform === 'kakao') return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}`;
}

function loadAvatar(evt, speaker) {
  const file = evt.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('이미지 파일만 사용할 수 있습니다.');
  if (file.size > 4 * 1024 * 1024) return showToast('프로필 이미지는 4MB 이하를 권장합니다.');

  const reader = new FileReader();
  reader.onload = () => {
    state.avatars[speaker] = reader.result;
    restoreAvatarUi(speaker);
    renderPreview();
  };
  reader.readAsDataURL(file);
}

async function handleLanguage(lang) {
  if (lang === 'ko') {
    state.messages = state.originals.map((m, i) => ({ ...m, time: state.messages[i]?.time || '' }));
    state.currentLang = 'ko';
    regenerateTimes();
    renderAll();
    showToast('한국어 원문으로 복원했습니다.');
    return;
  }
  await runAi('translate', lang);
}

async function runAi(mode, targetLang) {
  const gas = localStorage.getItem('chatCaptureGasUrl') || '';
  if (!gas) {
    openApiDialog();
    showToast('먼저 Apps Script를 연결해 주세요.');
    return;
  }
  if (!hasValidSession()) {
    openApiDialog();
    showToast('AI 연결 인증이 필요합니다.');
    return;
  }
  if (!state.messages.length) return;

  setAiBusy(true);
  try {
    const payload = {
      action: 'transform',
      token: state.authToken,
      mode,
      targetLang,
      platform: state.platform,
      tone: els.toneSelect.value,
      contextHint: els.contextHint.value.trim(),
      participants: { A: els.nameA.value, B: els.nameB.value },
      messages: state.messages.map((m, i) => ({
        id: i,
        speaker: m.speaker,
        text: mode === 'translate' ? (m.original || m.text) : m.text
      }))
    };

    const data = await postGas(gas, payload);
    if (data.ok === false) throw makeApiError(data);
    if (!Array.isArray(data.messages) || data.messages.length !== state.messages.length) throw new Error('AI 응답 메시지 수가 원문과 다릅니다.');

    state.messages = state.messages.map((m, i) => ({ ...m, text: data.messages[i].text ?? m.text }));
    if (mode === 'translate') state.currentLang = targetLang;
    regenerateTimes();
    renderAll();
    els.apiStatus.textContent = `${mode === 'translate' ? `${languageNames[targetLang]} 번역` : '자연화'} 완료 · ${data.model || 'OpenAI'}`;
    els.apiStatus.className = 'status-line ok';
    showToast(mode === 'translate' ? `${languageNames[targetLang]} 번역을 적용했습니다.` : '대화를 자연스럽게 다듬었습니다.');
  } catch (err) {
    console.error(err);
    if (err.code === 'AUTH_REQUIRED' || err.code === 'SESSION_EXPIRED') {
      clearSession();
      openApiDialog();
    }
    els.apiStatus.textContent = `AI 오류: ${err.message}`;
    els.apiStatus.className = 'status-line error';
    showToast('AI 처리에 실패했습니다.');
  } finally {
    setAiBusy(false);
  }
}

async function postGas(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Apps Script 응답을 읽지 못했습니다. 배포 URL과 접근 권한을 확인해 주세요.'); }
  return data;
}

function makeApiError(data) {
  const err = new Error(data.error || 'API request failed');
  err.code = data.code || '';
  return err;
}

function openApiDialog() {
  els.gasUrl.value = localStorage.getItem('chatCaptureGasUrl') || '';
  els.appPassword.value = '';
  if (!els.apiDialog.open) els.apiDialog.showModal();
}

async function connectApi() {
  const url = els.gasUrl.value.trim();
  const password = els.appPassword.value;
  if (!/^https:\/\/script\.google\.com\//.test(url)) return showToast('Apps Script Web App URL을 확인해 주세요.');
  if (!password) return showToast('앱 비밀번호를 입력해 주세요.');

  const button = $('connectApiBtn');
  button.disabled = true;
  button.textContent = '연결 중…';
  try {
    const data = await postGas(url, { action: 'auth', password });
    if (data.ok === false) throw makeApiError(data);
    if (!data.token) throw new Error('인증 토큰을 받지 못했습니다.');

    state.authToken = data.token;
    state.authExpiresAt = Date.now() + Math.max(1, Number(data.expiresIn || 21600) - 30) * 1000;
    sessionStorage.setItem('chatCaptureAuthToken', state.authToken);
    sessionStorage.setItem('chatCaptureAuthExpiresAt', String(state.authExpiresAt));
    localStorage.setItem('chatCaptureGasUrl', url);
    els.appPassword.value = '';
    els.apiDialog.close();
    updateApiStatus(data.model);
    showToast('AI 연결이 완료되었습니다.');
  } catch (err) {
    console.error(err);
    clearSession();
    els.apiStatus.textContent = `연결 실패: ${err.message}`;
    els.apiStatus.className = 'status-line error';
    showToast('연결에 실패했습니다.');
  } finally {
    button.disabled = false;
    button.textContent = '연결 테스트';
  }
}

function disconnectApi() {
  clearSession();
  els.appPassword.value = '';
  updateApiStatus();
  showToast('현재 AI 인증 세션을 해제했습니다.');
}

function clearSession() {
  state.authToken = '';
  state.authExpiresAt = 0;
  sessionStorage.removeItem('chatCaptureAuthToken');
  sessionStorage.removeItem('chatCaptureAuthExpiresAt');
}

function validateStoredSession() {
  if (!state.authToken || !state.authExpiresAt || Date.now() >= state.authExpiresAt) clearSession();
}

function hasValidSession() {
  validateStoredSession();
  return Boolean(state.authToken && state.authExpiresAt > Date.now());
}

function updateApiStatus(model = '') {
  const hasUrl = Boolean(localStorage.getItem('chatCaptureGasUrl'));
  const connected = hasUrl && hasValidSession();
  els.connectionPill.classList.toggle('connected', connected);
  qs('span', els.connectionPill).textContent = connected ? 'AI 연결됨' : hasUrl ? '인증 필요' : 'AI 미연결';
  els.apiStatus.textContent = connected
    ? `보안 세션 연결됨${model ? ` · ${model}` : ''}`
    : hasUrl ? 'Apps Script URL은 저장되어 있습니다. 앱 비밀번호로 인증해 주세요.' : 'AI 기능은 Google Apps Script 연결 후 사용할 수 있습니다.';
  els.apiStatus.className = `status-line ${connected ? 'ok' : ''}`;
}

function setAiBusy(on) {
  qsa('.btn.ai').forEach((b) => {
    b.disabled = on;
    b.classList.toggle('busy', on);
  });
}

function saveDraft() {
  const draft = {
    platform: state.platform,
    messages: state.messages,
    originals: state.originals,
    avatars: state.avatars,
    currentLang: state.currentLang,
    fields: {
      chatTitle: els.chatTitle.value,
      chatDate: els.chatDate.value,
      startTime: els.startTime.value,
      toneSelect: els.toneSelect.value,
      nameA: els.nameA.value,
      nameB: els.nameB.value,
      contextHint: els.contextHint.value,
      rawConversation: els.rawConversation.value
    },
    mockup: els.mockupToggle.checked,
    readReceipt: els.readReceiptToggle.checked
  };

  try {
    localStorage.setItem('chatCaptureDraft', JSON.stringify(draft));
    showToast('현재 작업을 이 브라우저에 저장했습니다.');
  } catch {
    showToast('저장 용량이 부족합니다. 프로필 이미지 크기를 줄여 주세요.');
  }
}

function loadDraft() {
  const raw = localStorage.getItem('chatCaptureDraft');
  if (!raw) return showToast('저장된 작업이 없습니다.');

  try {
    const d = JSON.parse(raw);
    Object.assign(state, {
      platform: d.platform || 'kakao',
      messages: d.messages || [],
      originals: d.originals || [],
      avatars: d.avatars || { A: '', B: '' },
      currentLang: d.currentLang || 'ko'
    });
    Object.entries(d.fields || {}).forEach(([k, v]) => { if ($(k)) $(k).value = v; });
    els.mockupToggle.checked = d.mockup !== false;
    els.readReceiptToggle.checked = d.readReceipt !== false;
    qsa('.platform-card').forEach((x) => x.classList.toggle('active', x.dataset.platform === state.platform));
    restoreAvatarUi('A');
    restoreAvatarUi('B');
    regenerateTimes();
    renderAll();
    showToast('저장된 작업을 불러왔습니다.');
  } catch {
    showToast('저장 데이터를 불러오지 못했습니다.');
  }
}

function restoreAvatarUi(s) {
  const img = $(s === 'A' ? 'avatarAImg' : 'avatarBImg');
  const fallback = $(s === 'A' ? 'avatarAFallback' : 'avatarBFallback');
  if (state.avatars[s]) {
    img.src = state.avatars[s];
    img.style.display = 'block';
    fallback.style.display = 'none';
  } else {
    img.style.display = 'none';
    fallback.style.display = 'grid';
    fallback.textContent = participantInitial(s);
  }
}

function resetApp() {
  if (!confirm('현재 편집 내용을 초기화할까요?')) return;
  state.platform = 'kakao';
  state.avatars = { A: '', B: '' };
  state.currentLang = 'ko';
  els.chatTitle.value = 'Tommy';
  els.nameA.value = 'lamjskim';
  els.nameB.value = 'Tommy';
  els.chatDate.value = localDateValue();
  els.startTime.value = localTimeValue();
  els.contextHint.value = '';
  els.toneSelect.value = 'natural-business';
  els.mockupToggle.checked = true;
  els.readReceiptToggle.checked = true;
  els.rawConversation.value = 'A: 오늘 SM 시장 어때?\nB: 중국 내수에서 prompt short covering이 계속 나오고 있어.\nA: LG도 이제 들어오나 보네.\nB: 한국과 일본 쪽 물량이 거의 말라서 필요하면 중국밖에 없을 듯.';
  restoreAvatarUi('A');
  restoreAvatarUi('B');
  qsa('.platform-card').forEach((x) => x.classList.toggle('active', x.dataset.platform === 'kakao'));
  parseConversation(false);
  showToast('편집 내용을 초기화했습니다.');
}

async function createCaptureCanvas(full) {
  if (typeof html2canvas === 'undefined') throw new Error('캡처 라이브러리를 불러오지 못했습니다.');
  const phone = els.captureTarget;
  const scroll = els.chatScroll;
  const original = {
    phoneHeight: phone.style.height,
    scrollOverflow: scroll.style.overflow,
    scrollHeight: scroll.style.height,
    scrollFlex: scroll.style.flex
  };

  try {
    if (full) {
      scroll.style.overflow = 'visible';
      scroll.style.height = 'auto';
      scroll.style.flex = 'none';
      const contentHeight = scroll.scrollHeight;
      scroll.style.height = `${contentHeight}px`;
      phone.style.height = 'auto';
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return await html2canvas(phone, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
  } finally {
    phone.style.height = original.phoneHeight;
    scroll.style.overflow = original.scrollOverflow;
    scroll.style.height = original.scrollHeight;
    scroll.style.flex = original.scrollFlex;
  }
}

async function downloadCapture(full) {
  try {
    const canvas = await createCaptureCanvas(full);
    const link = document.createElement('a');
    const safeTitle = (els.chatTitle.value || 'chat').replace(/[^\w가-힣ぁ-んァ-ン一-龥-]+/g, '_');
    const stamp = `${els.chatDate.value}_${state.platform}_${safeTitle}`;
    link.download = `chat_${stamp}${full ? '_full' : ''}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('PNG 이미지를 저장했습니다.');
  } catch (err) {
    console.error(err);
    showToast(`이미지 저장 실패: ${err.message}`);
  }
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

initDefaults();
