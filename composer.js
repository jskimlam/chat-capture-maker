(() => {
  const structuredList = document.getElementById('structuredMessageList');
  const addMineBtn = document.getElementById('addMineMessageBtn');
  const addTheirsBtn = document.getElementById('addTheirsMessageBtn');
  const addNextBtn = document.getElementById('addNextMessageBtn');
  if (!structuredList || !addMineBtn || !addTheirsBtn || !addNextBtn) return;

  const baseRenderAll = renderAll;
  renderAll = function enhancedRenderAll() {
    baseRenderAll();
    renderStructuredComposer();
  };

  function participantLabel(speaker) {
    const name = speaker === 'A' ? (els.nameA.value || 'A') : (els.nameB.value || 'B');
    return speaker === 'A' ? `나 · ${name}` : `상대 · ${name}`;
  }

  function syncLegacyText() {
    if (!els.rawConversation) return;
    els.rawConversation.value = state.messages.map((m) => `${m.speaker}: ${m.text}`).join('\n');
  }

  function ensureOriginal(index) {
    const msg = state.messages[index];
    if (!msg) return;
    if (!state.originals[index]) state.originals[index] = { ...msg, original: msg.original || msg.text };
  }

  function addStructuredMessage(speaker, afterIndex = null) {
    const item = { speaker, text: '', original: '', time: '' };
    const originalItem = { ...item };
    let index;

    if (Number.isInteger(afterIndex)) {
      index = Math.min(Math.max(afterIndex + 1, 0), state.messages.length);
      state.messages.splice(index, 0, item);
      state.originals.splice(index, 0, originalItem);
    } else {
      index = state.messages.length;
      state.messages.push(item);
      state.originals.push(originalItem);
    }

    regenerateTimes();
    syncLegacyText();
    renderAll();
    focusStructured(index);
  }

  function focusStructured(index) {
    requestAnimationFrame(() => {
      const target = structuredList.querySelector(`[data-message-index="${index}"] textarea`);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function setSpeaker(index, speaker) {
    const msg = state.messages[index];
    if (!msg || msg.speaker === speaker) return;
    msg.speaker = speaker;
    ensureOriginal(index);
    state.originals[index].speaker = speaker;
    syncLegacyText();
    renderAll();
    focusStructured(index);
  }

  function removeMessage(index) {
    state.messages.splice(index, 1);
    state.originals.splice(index, 1);
    regenerateTimes();
    syncLegacyText();
    renderAll();
  }

  function moveMessage(index, direction) {
    const next = index + direction;
    if (next < 0 || next >= state.messages.length) return;
    [state.messages[index], state.messages[next]] = [state.messages[next], state.messages[index]];
    [state.originals[index], state.originals[next]] = [state.originals[next], state.originals[index]];
    regenerateTimes();
    syncLegacyText();
    renderAll();
    focusStructured(next);
  }

  function renderStructuredComposer() {
    structuredList.innerHTML = '';

    if (!state.messages.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-structured';
      empty.textContent = '아래 버튼으로 첫 메시지를 추가하세요.';
      structuredList.append(empty);
      return;
    }

    state.messages.forEach((msg, index) => {
      const card = document.createElement('div');
      card.className = 'structured-message';
      card.dataset.speaker = msg.speaker;
      card.dataset.messageIndex = String(index);

      const speakerSegment = document.createElement('div');
      speakerSegment.className = 'speaker-segment';

      const mine = document.createElement('button');
      mine.type = 'button';
      mine.className = `speaker-choice${msg.speaker === 'A' ? ' active a' : ''}`;
      mine.textContent = participantLabel('A');
      mine.title = '이 메시지를 내 메시지로 설정';
      mine.addEventListener('click', () => setSpeaker(index, 'A'));

      const theirs = document.createElement('button');
      theirs.type = 'button';
      theirs.className = `speaker-choice${msg.speaker === 'B' ? ' active b' : ''}`;
      theirs.textContent = participantLabel('B');
      theirs.title = '이 메시지를 상대방 메시지로 설정';
      theirs.addEventListener('click', () => setSpeaker(index, 'B'));
      speakerSegment.append(mine, theirs);

      const textarea = document.createElement('textarea');
      textarea.value = msg.text;
      textarea.maxLength = 5000;
      textarea.placeholder = msg.speaker === 'A' ? '내 메시지를 입력하세요' : '상대방 메시지를 입력하세요';
      textarea.setAttribute('aria-label', `${participantLabel(msg.speaker)} 메시지 ${index + 1}`);
      textarea.addEventListener('input', () => {
        const value = clampText(textarea.value);
        msg.text = value;
        if (state.currentLang === 'ko' || !msg.original) {
          msg.original = value;
          ensureOriginal(index);
          state.originals[index].text = value;
          state.originals[index].original = value;
        }
        const counter = card.querySelector('.structured-char-count');
        if (counter) counter.textContent = `${value.length}자`;
        syncLegacyText();
        regenerateTimes();
        renderPreview();
        renderMessageEditor();
      });
      textarea.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          const nextSpeaker = msg.speaker === 'A' ? 'B' : 'A';
          addStructuredMessage(nextSpeaker, index);
        }
      });

      const tools = document.createElement('div');
      tools.className = 'structured-message-tools';
      const up = document.createElement('button');
      up.type = 'button'; up.className = 'mini-tool'; up.textContent = '↑'; up.title = '위로 이동';
      up.disabled = index === 0; up.addEventListener('click', () => moveMessage(index, -1));
      const down = document.createElement('button');
      down.type = 'button'; down.className = 'mini-tool'; down.textContent = '↓'; down.title = '아래로 이동';
      down.disabled = index === state.messages.length - 1; down.addEventListener('click', () => moveMessage(index, 1));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'mini-tool delete'; del.textContent = '×'; del.title = '메시지 삭제';
      del.addEventListener('click', () => removeMessage(index));
      tools.append(up, down, del);

      const meta = document.createElement('div');
      meta.className = 'structured-message-meta';
      const time = document.createElement('span');
      time.textContent = `자동 시간 ${msg.time || '--:--'}`;
      const count = document.createElement('span');
      count.className = 'structured-char-count';
      count.textContent = `${msg.text.length}자`;
      meta.append(time, count);

      card.append(speakerSegment, textarea, tools, meta);
      structuredList.append(card);
    });
  }

  addMineBtn.addEventListener('click', () => addStructuredMessage('A'));
  addTheirsBtn.addEventListener('click', () => addStructuredMessage('B'));
  addNextBtn.addEventListener('click', () => {
    const lastSpeaker = state.messages.at(-1)?.speaker || 'B';
    addStructuredMessage(lastSpeaker === 'A' ? 'B' : 'A');
  });

  ['nameA', 'nameB'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderStructuredComposer);
  });

  renderStructuredComposer();
})();

/* App-style empty profile fallbacks for KakaoTalk / WeChat */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .app-default-avatar{position:relative!important;display:grid!important;place-items:center!important;overflow:hidden!important;color:transparent!important;font-size:0!important;background:#d9dde2!important}
    .app-default-avatar::before{content:"";position:absolute;width:35%;height:35%;left:32.5%;top:17%;border-radius:50%;background:#a9afb6}
    .app-default-avatar::after{content:"";position:absolute;width:70%;height:46%;left:15%;bottom:-8%;border-radius:50% 50% 20% 20%;background:#a9afb6}
    .app-default-avatar.kakao-empty{background:#dfe3e7!important;border-radius:13px!important}
    .app-default-avatar.kakao-empty::before,.app-default-avatar.kakao-empty::after{background:#abb2b9}
    .app-default-avatar.wechat-empty{background:#d5d5d5!important;border-radius:4px!important}
    .app-default-avatar.wechat-empty::before,.app-default-avatar.wechat-empty::after{background:#a5a5a5}
    .avatar-editor.app-default-avatar{width:46px!important;height:46px!important}
    .header-profile.app-default-avatar{width:31px!important;height:31px!important;border-radius:50%!important}
  `;
  document.head.appendChild(style);

  function usesPersonFallback() {
    return state.platform === 'kakao' || state.platform === 'wechat';
  }

  function fallbackClass() {
    return state.platform === 'wechat' ? 'wechat-empty' : 'kakao-empty';
  }

  const originalMakeAvatar = makeAvatar;
  makeAvatar = function appDefaultMakeAvatar(speaker) {
    if (!state.avatars[speaker] && usesPersonFallback()) {
      const d = document.createElement('div');
      d.className = `msg-avatar app-default-avatar ${fallbackClass()}`;
      d.setAttribute('aria-label', '기본 프로필');
      return d;
    }
    return originalMakeAvatar(speaker);
  };

  const originalRestoreAvatarUi = restoreAvatarUi;
  restoreAvatarUi = function appDefaultRestoreAvatarUi(speaker) {
    const img = $(speaker === 'A' ? 'avatarAImg' : 'avatarBImg');
    const fallback = $(speaker === 'A' ? 'avatarAFallback' : 'avatarBFallback');
    if (state.avatars[speaker] || !usesPersonFallback()) {
      fallback.classList.remove('app-default-avatar', 'kakao-empty', 'wechat-empty');
      return originalRestoreAvatarUi(speaker);
    }
    img.style.display = 'none';
    fallback.textContent = '';
    fallback.style.display = 'grid';
    fallback.classList.remove('kakao-empty', 'wechat-empty');
    fallback.classList.add('app-default-avatar', fallbackClass());
  };

  const originalRenderHeaderAvatar = renderHeaderAvatar;
  renderHeaderAvatar = function appDefaultRenderHeaderAvatar() {
    if (!state.avatars.B && usesPersonFallback()) {
      els.headerAvatar.style.display = 'none';
      els.headerAvatarFallback.textContent = '';
      els.headerAvatarFallback.style.display = 'grid';
      els.headerProfile.classList.remove('kakao-empty', 'wechat-empty');
      els.headerProfile.classList.add('app-default-avatar', fallbackClass());
      return;
    }
    els.headerProfile.classList.remove('app-default-avatar', 'kakao-empty', 'wechat-empty');
    originalRenderHeaderAvatar();
  };

  function refreshParticipantFallbacks() {
    restoreAvatarUi('A');
    restoreAvatarUi('B');
  }

  const previousRenderAll = renderAll;
  renderAll = function profileAwareRenderAll() {
    previousRenderAll();
    refreshParticipantFallbacks();
  };

  if (els.platformPicker) {
    els.platformPicker.addEventListener('click', () => requestAnimationFrame(refreshParticipantFallbacks));
  }

  refreshParticipantFallbacks();
  renderPreview();
})();
