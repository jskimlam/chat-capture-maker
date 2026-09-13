(() => {
  const THEME_KEY = 'chatCapturePreviewThemeV2';
  const validThemes = new Set(['light','dark','auto']);
  let previewTheme = localStorage.getItem(THEME_KEY) || 'light';
  if (!validThemes.has(previewTheme)) previewTheme = 'light';

  const icon = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.3 3.6l2.1 4.2-2 1.5c1.2 2.5 3.2 4.5 5.7 5.7l1.5-2 4.2 2.1-.7 4c-.1.7-.8 1.2-1.5 1.2C9.8 20.3 3.7 14.2 3.7 6.7c0-.7.5-1.3 1.2-1.5l2.4-.6z"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="11" height="12" rx="2"/><path d="M14.5 10l5-3v10l-5-3z"/></svg>',
    smile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.5 14.5c1.7 2 5.3 2 7 0"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    hash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3L7 21M17 3l-2 18M4 9h16M3 15h16"/></svg>',
    paperclip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5l6-6a3 3 0 114.2 4.2l-8.2 8.2a5 5 0 01-7.1-7.1l8-8"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6"/></svg>',
    voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6M9 6v12M13 4v16M17 7v10M21 10v4"/></svg>'
  };

  function themeNow(){
    if (previewTheme === 'auto') return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return previewTheme;
  }

  function ensureThemePicker(){
    if (document.getElementById('previewThemePicker')) return;
    const host = document.getElementById('platformPicker');
    if (!host) return;
    const row = document.createElement('div');
    row.id = 'previewThemePicker';
    row.className = 'preview-theme-row';
    row.innerHTML = '<span>채팅 화면 테마</span><div class="preview-theme-options"><button type="button" class="preview-theme-btn" data-preview-theme="light">라이트</button><button type="button" class="preview-theme-btn" data-preview-theme="dark">다크</button><button type="button" class="preview-theme-btn" data-preview-theme="auto">자동</button></div>';
    host.insertAdjacentElement('afterend', row);
    row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preview-theme]');
      if (!b) return;
      previewTheme = b.dataset.previewTheme;
      localStorage.setItem(THEME_KEY, previewTheme);
      updateThemeButtons();
      renderPreview();
    });
    updateThemeButtons();
  }

  function updateThemeButtons(){
    document.querySelectorAll('[data-preview-theme]').forEach(b => b.classList.toggle('active', b.dataset.previewTheme === previewTheme));
  }

  function avatarHtml(speaker, extraClass=''){
    const src = state.avatars[speaker];
    if (src) return `<div class="ccm-header-avatar ${extraClass}"><img src="${src}" alt=""></div>`;
    return `<div class="ccm-header-avatar ccm-default-avatar ${extraClass}" aria-hidden="true"></div>`;
  }

  function headerButton(which, label){
    return `<button type="button" class="ccm-icon-btn" aria-label="${label}">${icon[which]}</button>`;
  }

  function buildHeader(){
    const h = document.getElementById('chatHeader');
    if (!h) return;
    const title = (els.chatTitle.value || els.nameB.value || 'Chat').trim();
    const online = state.currentLang === 'zh' ? '在线' : state.currentLang === 'ja' ? 'オンライン' : state.currentLang === 'en' ? 'online' : '온라인';
    let body = '';

    if (state.platform === 'kakao') {
      body = `<button type="button" class="ccm-header-back" aria-label="뒤로">${icon.back}</button><div class="ccm-header-main"><div class="ccm-header-title">${escapeHtml(title)}</div></div><div class="ccm-header-actions">${headerButton('search','검색')}${headerButton('phone','전화')}${headerButton('menu','메뉴')}</div>`;
    } else if (state.platform === 'wechat') {
      body = `<button type="button" class="ccm-header-back" aria-label="뒤로">${icon.back}</button><div class="ccm-header-main"><div class="ccm-header-title">${escapeHtml(title)}</div></div><div class="ccm-header-actions">${headerButton('more','더보기')}</div>`;
    } else if (state.platform === 'whatsapp') {
      body = `<button type="button" class="ccm-header-back" aria-label="뒤로">${icon.back}</button>${avatarHtml('B')}<div class="ccm-header-main"><div class="ccm-header-title">${escapeHtml(title)}</div><div class="ccm-header-subtitle">${online}</div></div><div class="ccm-header-actions">${headerButton('video','영상통화')}${headerButton('phone','전화')}${headerButton('more','더보기')}</div>`;
    } else {
      body = `<button type="button" class="ccm-header-back" aria-label="뒤로">${icon.back}</button>${avatarHtml('B')}<div class="ccm-header-main"><div class="ccm-header-title">${escapeHtml(title)}</div><div class="ccm-header-subtitle">${online}</div></div><div class="ccm-header-actions">${headerButton('phone','전화')}${headerButton('more','더보기')}</div>`;
    }
    h.innerHTML = body;
  }

  function buildComposer(){
    const bar = qs('.composer-bar', els.captureTarget);
    if (!bar) return;
    const placeholder = platformPlaceholders[state.platform] || 'Message';
    const c = (name) => `<span class="ccm-composer-icon" aria-hidden="true">${icon[name]}</span>`;
    if (state.platform === 'kakao') bar.innerHTML = `${c('plus')}<div class="fake-input">${escapeHtml(placeholder)}</div>${c('smile')}${c('hash')}`;
    else if (state.platform === 'wechat') bar.innerHTML = `${c('voice')}<div class="fake-input">${escapeHtml(placeholder)}</div>${c('smile')}${c('plus')}`;
    else if (state.platform === 'whatsapp') bar.innerHTML = `${c('smile')}<div class="fake-input">${escapeHtml(placeholder)}</div>${c('paperclip')}${c('mic')}`;
    else bar.innerHTML = `${c('smile')}<div class="fake-input">${escapeHtml(placeholder)}</div>${c('paperclip')}${c('mic')}`;
  }

  function escapeHtml(v){
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function makeSideAvatar(speaker){
    if (state.avatars[speaker]) return makeAvatar(speaker);
    const d = document.createElement('div');
    d.className = 'msg-avatar ccm-default-avatar';
    return d;
  }

  function makeSpacer(){
    const s = document.createElement('div');
    s.className = 'avatar-spacer';
    return s;
  }

  function renderPreviewV2(){
    const resolved = themeNow();
    els.captureTarget.className = `phone platform-${state.platform} theme-${resolved}`;
    els.captureTarget.dataset.platform = state.platform;
    els.captureTarget.dataset.theme = resolved;
    els.previewTitle.textContent = els.chatTitle.value || els.nameB.value || 'Chat';
    els.platformLabel.textContent = platformNames[state.platform];
    els.dateSeparator.textContent = formatDate(els.chatDate.value, state.platform);
    els.messageList.innerHTML = '';

    buildHeader();
    buildComposer();

    const groupEnds = state.messages.map((m, i) => i === state.messages.length - 1 || state.messages[i + 1].speaker !== m.speaker || state.messages[i + 1].time !== m.time);

    state.messages.forEach((msg, i) => {
      const mine = msg.speaker === 'A';
      const first = i === 0 || state.messages[i - 1].speaker !== msg.speaker;
      const row = document.createElement('div');
      row.className = `message-row ${mine ? 'mine' : 'theirs'}`;

      const showKakaoAvatar = state.platform === 'kakao' && !mine;
      const showWechatAvatar = state.platform === 'wechat';
      const showAvatar = showKakaoAvatar || showWechatAvatar;
      const avatar = showAvatar ? (first ? makeSideAvatar(msg.speaker) : makeSpacer()) : null;

      const stack = document.createElement('div');
      stack.className = 'message-stack';

      if (!mine && first && state.platform === 'kakao') {
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

      const inBubbleMeta = state.platform === 'whatsapp' || state.platform === 'telegram';
      if (inBubbleMeta && groupEnds[i]) bubble.append(makeMeta(msg, mine));
      line.append(bubble);
      if (!inBubbleMeta && groupEnds[i]) line.append(makeOutsideMeta(msg, mine));
      stack.append(line);

      if (showAvatar && mine) row.append(stack, avatar);
      else if (showAvatar) row.append(avatar, stack);
      else row.append(stack);
      els.messageList.append(row);
    });

    els.mockupMark.style.display = els.mockupToggle.checked ? 'block' : 'none';
  }

  renderPreview = renderPreviewV2;

  createCaptureCanvas = async function(full){
    if (typeof html2canvas === 'undefined') throw new Error('캡처 라이브러리를 불러오지 못했습니다.');
    const phone = els.captureTarget;
    const scroll = els.chatScroll;
    const header = document.getElementById('chatHeader');
    const status = qs('.phone-statusbar', phone);
    const composer = qs('.composer-bar', phone);
    const original = {
      phoneHeight: phone.style.height,
      phoneOverflow: phone.style.overflow,
      scrollOverflow: scroll.style.overflow,
      scrollHeight: scroll.style.height,
      scrollFlex: scroll.style.flex
    };
    try {
      phone.classList.add('capture-preparing');
      if (full) {
        scroll.style.overflow = 'visible';
        scroll.style.height = 'auto';
        scroll.style.flex = 'none';
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const contentHeight = Math.max(scroll.scrollHeight, scroll.offsetHeight);
        scroll.style.height = `${contentHeight}px`;
        const total = (status?.offsetHeight || 0) + (header?.offsetHeight || 0) + contentHeight + (composer?.offsetHeight || 0) + 12;
        phone.style.height = `${total}px`;
        phone.style.overflow = 'visible';
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return await html2canvas(phone, { scale: 2, useCORS: true, backgroundColor: null, logging: false, scrollX: 0, scrollY: 0, windowWidth: phone.scrollWidth });
    } finally {
      phone.classList.remove('capture-preparing');
      phone.style.height = original.phoneHeight;
      phone.style.overflow = original.phoneOverflow;
      scroll.style.overflow = original.scrollOverflow;
      scroll.style.height = original.scrollHeight;
      scroll.style.flex = original.scrollFlex;
    }
  };

  ensureThemePicker();
  updateThemeButtons();
  renderPreview();

  const media = matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => { if (previewTheme === 'auto') renderPreview(); };
  if (media.addEventListener) media.addEventListener('change', onScheme); else if (media.addListener) media.addListener(onScheme);
})();
