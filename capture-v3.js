(() => {
  const DATE_KEY = 'chatCaptureShowDateV1';
  const TIME_KEY = 'chatCaptureShowTimeV1';
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  async function waitForFonts() {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch (_) {}
  }

  async function waitForImages(root) {
    const images = [...root.querySelectorAll('img')];
    await Promise.all(images.map(async img => {
      try {
        if (img.complete && img.naturalWidth > 0) {
          if (img.decode) await img.decode().catch(() => {});
          return;
        }
        await new Promise(resolve => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 1800);
        });
        if (img.decode) await img.decode().catch(() => {});
      } catch (_) {}
    }));
  }

  function stripIds(root) {
    root.removeAttribute('id');
    root.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  }

  function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
  }

  function toMinutes(value, fallback = 540) {
    if (!isValidTime(value)) return fallback;
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  }

  function fromMinutes(value) {
    const normalized = ((value % 1440) + 1440) % 1440;
    return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
  }

  /* Final time engine: start time drives automatic timestamps, while any
     message can be pinned to an exact manual time. The next automatic
     message continues naturally from the last displayed time. */
  regenerateTimes = function finalRegenerateTimes() {
    if (!state.messages.length) return;
    let cursor = toMinutes(els.startTime.value || '09:00', 540);

    state.messages.forEach((msg, i) => {
      const manual = isValidTime(msg.manualTime) ? msg.manualTime : '';
      if (manual) {
        cursor = toMinutes(manual, cursor);
        msg.manualTime = manual;
        msg.time = manual;
        return;
      }

      msg.manualTime = '';
      if (i > 0) {
        const previousLength = state.messages[i - 1].text.length;
        const semanticPause = previousLength > 80 ? 2 : previousLength > 35 ? 1 : 0;
        const alternatingPause = (i * 7 + previousLength) % 4 === 0 ? 1 : 0;
        cursor += 1 + Math.min(semanticPause + alternatingPause, 3);
      }
      msg.time = fromMinutes(cursor);
    });

    if (els.statusTime) els.statusTime.textContent = fromMinutes(cursor + 1);
  };

  function injectFinalPolishStyles() {
    if (document.getElementById('ccmFinalPolishStyles')) return;
    const style = document.createElement('style');
    style.id = 'ccmFinalPolishStyles';
    style.textContent = `
      /* Final spacing pass: closer to native messaging-app rhythm. */
      #captureTarget .message-row{margin:0 0 7px!important}
      #captureTarget .message-row + .message-row{margin-top:3px!important}
      #captureTarget .message-row.mine + .message-row.theirs,
      #captureTarget .message-row.theirs + .message-row.mine{margin-top:10px!important}
      #captureTarget .sender-name{margin-bottom:6px!important}
      #captureTarget .bubble{padding:9px 13px 11px!important;line-height:1.42!important}
      #captureTarget .bubble-text{display:block;transform:translateY(-1px)}
      #captureTarget.platform-kakao .bubble{padding:9px 14px 11px!important}
      #captureTarget.platform-wechat .bubble{padding:9px 13px 10px!important}
      #captureTarget.platform-whatsapp .bubble,
      #captureTarget.platform-telegram .bubble{padding:9px 13px 10px!important}
      #captureTarget .outside-meta{margin-bottom:2px!important}
      #captureTarget .date-separator{transition:none}

      /* The export clone lives outside #captureTarget, so mirror the same layout. */
      .capture-export .message-row{margin:0 0 7px!important}
      .capture-export .message-row + .message-row{margin-top:3px!important}
      .capture-export .message-row.mine + .message-row.theirs,
      .capture-export .message-row.theirs + .message-row.mine{margin-top:10px!important}
      .capture-export .sender-name{margin-bottom:6px!important}
      .capture-export .bubble{padding:9px 13px 11px!important;line-height:1.42!important}
      .capture-export .bubble-text{display:block;transform:translateY(-1px)}
      .capture-export.platform-kakao .bubble{padding:9px 14px 11px!important}
      .capture-export.platform-wechat .bubble{padding:9px 13px 10px!important}
      .capture-export.platform-whatsapp .bubble,
      .capture-export.platform-telegram .bubble{padding:9px 13px 10px!important}
      .capture-export .outside-meta{margin-bottom:2px!important}

      /* Per-message time editor. */
      .structured-message-meta{align-items:center!important;flex-wrap:wrap!important}
      .message-time-editor{display:flex;align-items:center;gap:5px;min-width:0}
      .message-time-editor .time-caption{font-size:9px;color:#7f91a8;font-weight:700}
      .message-time-input{width:92px!important;min-height:30px!important;height:30px!important;border:1px solid #314159!important;background:#0b1321!important;color:#dfe8f5!important;border-radius:8px!important;padding:3px 7px!important;font-size:11px!important;color-scheme:dark}
      .message-time-input.manual{border-color:#718fff!important;box-shadow:0 0 0 2px rgba(113,143,255,.08)}
      .message-time-auto{height:30px;border:1px solid #34445e;background:#172338;color:#aebdd0;border-radius:8px;padding:0 8px;font-size:9px;font-weight:800}
      .message-time-auto.active{background:#24365d;border-color:#5876e7;color:#dce5ff}
      .message-time-mode{font-size:8px;font-weight:800;color:#70839d;min-width:24px}
      .message-time-mode.manual{color:#8ea5ff}
      @media(max-width:720px){
        .structured-message-meta{grid-column:1/-1!important;margin-top:2px!important}
        .message-time-editor{order:1;flex:1 1 100%}
        .structured-char-count{order:2;margin-left:auto}
        .message-time-input{width:110px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function applyDateVisibility(root = els.captureTarget) {
    const separator = root?.querySelector('.date-separator');
    const toggle = document.getElementById('dateSeparatorToggle');
    const visible = toggle ? toggle.checked : localStorage.getItem(DATE_KEY) !== '0';
    if (separator) separator.style.display = visible ? '' : 'none';
  }

  function applyTimeVisibility(root = els.captureTarget) {
    if (!root) return;
    const toggle = document.getElementById('messageTimeToggle');
    const visible = toggle ? toggle.checked : localStorage.getItem(TIME_KEY) !== '0';

    root.querySelectorAll('.msg-time').forEach(node => {
      node.style.display = visible ? '' : 'none';
    });

    root.querySelectorAll('.outside-meta').forEach(meta => {
      if (visible) meta.style.display = '';
      else meta.style.display = meta.querySelector('.kakao-unread') ? '' : 'none';
    });

    root.querySelectorAll('.bubble-meta').forEach(meta => {
      if (visible) meta.style.display = '';
      else meta.style.display = meta.querySelector('.read-receipt') ? '' : 'none';
    });
  }

  function setupDateToggle() {
    if (document.getElementById('dateSeparatorToggle')) {
      const existing = document.getElementById('dateSeparatorToggle');
      existing.checked = localStorage.getItem(DATE_KEY) !== '0';
      applyDateVisibility();
      return;
    }
    const row = document.querySelector('.option-row');
    if (!row) return;

    const label = document.createElement('label');
    label.className = 'check-option';
    const checked = localStorage.getItem(DATE_KEY) !== '0';
    label.innerHTML = `<input type="checkbox" id="dateSeparatorToggle" ${checked ? 'checked' : ''}><span>날짜 표시</span>`;
    row.appendChild(label);

    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      localStorage.setItem(DATE_KEY, input.checked ? '1' : '0');
      applyDateVisibility();
    });
    applyDateVisibility();
  }

  function setupTimeToggle() {
    if (document.getElementById('messageTimeToggle')) {
      const existing = document.getElementById('messageTimeToggle');
      existing.checked = localStorage.getItem(TIME_KEY) !== '0';
      applyTimeVisibility();
      return;
    }
    const row = document.querySelector('.option-row');
    if (!row) return;

    const label = document.createElement('label');
    label.className = 'check-option';
    const checked = localStorage.getItem(TIME_KEY) !== '0';
    label.innerHTML = `<input type="checkbox" id="messageTimeToggle" ${checked ? 'checked' : ''}><span>시간 표시</span>`;
    row.appendChild(label);

    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      localStorage.setItem(TIME_KEY, input.checked ? '1' : '0');
      applyTimeVisibility();
    });
    applyTimeVisibility();
  }

  function syncManualTimeToOriginal(index, value) {
    if (!state.originals[index]) state.originals[index] = { ...state.messages[index] };
    state.originals[index].manualTime = value;
    state.originals[index].time = state.messages[index]?.time || value;
  }

  function enhanceTimeEditors() {
    const cards = [...document.querySelectorAll('#structuredMessageList .structured-message')];
    cards.forEach(card => {
      const index = Number(card.dataset.messageIndex);
      const msg = state.messages[index];
      const meta = card.querySelector('.structured-message-meta');
      if (!msg || !meta) return;

      const countText = `${msg.text.length}자`;
      meta.innerHTML = '';

      const editor = document.createElement('div');
      editor.className = 'message-time-editor';

      const caption = document.createElement('span');
      caption.className = 'time-caption';
      caption.textContent = '시간';

      const input = document.createElement('input');
      input.type = 'time';
      input.step = '60';
      input.className = `message-time-input${msg.manualTime ? ' manual' : ''}`;
      input.value = msg.time || '';
      input.title = '이 메시지의 시간을 직접 지정';
      input.addEventListener('change', () => {
        const value = isValidTime(input.value) ? input.value : '';
        msg.manualTime = value;
        syncManualTimeToOriginal(index, value);
        regenerateTimes();
        renderAll();
      });

      const auto = document.createElement('button');
      auto.type = 'button';
      auto.className = `message-time-auto${msg.manualTime ? '' : ' active'}`;
      auto.textContent = '자동';
      auto.title = '시작 시간 기준 자동 배치로 되돌리기';
      auto.addEventListener('click', () => {
        msg.manualTime = '';
        syncManualTimeToOriginal(index, '');
        regenerateTimes();
        renderAll();
      });

      const mode = document.createElement('span');
      mode.className = `message-time-mode${msg.manualTime ? ' manual' : ''}`;
      mode.textContent = msg.manualTime ? '수동' : '자동';

      const count = document.createElement('span');
      count.className = 'structured-char-count';
      count.textContent = countText;

      editor.append(caption, input, auto, mode);
      meta.append(editor, count);
    });
  }

  function refreshTimeEditorValues() {
    document.querySelectorAll('#structuredMessageList .structured-message').forEach(card => {
      const index = Number(card.dataset.messageIndex);
      const msg = state.messages[index];
      if (!msg) return;
      const input = card.querySelector('.message-time-input');
      const auto = card.querySelector('.message-time-auto');
      const mode = card.querySelector('.message-time-mode');
      if (input && document.activeElement !== input) input.value = msg.time || '';
      if (input) input.classList.toggle('manual', Boolean(msg.manualTime));
      if (auto) auto.classList.toggle('active', !msg.manualTime);
      if (mode) {
        mode.textContent = msg.manualTime ? '수동' : '자동';
        mode.classList.toggle('manual', Boolean(msg.manualTime));
      }
    });
  }

  function fitHeaderTitle(root) {
    const host = root.querySelector('.ccm-header-main');
    const title = root.querySelector('.ccm-header-title');
    if (!host || !title) return;

    title.style.setProperty('overflow', 'visible', 'important');
    title.style.setProperty('text-overflow', 'clip', 'important');
    title.style.setProperty('white-space', 'nowrap', 'important');

    let size = parseFloat(getComputedStyle(title).fontSize) || 16;
    const minimum = 11.5;
    let guard = 0;
    while (title.scrollWidth > host.clientWidth + 1 && size > minimum && guard < 20) {
      size -= 0.5;
      title.style.setProperty('font-size', `${size}px`, 'important');
      guard += 1;
    }
  }

  function chooseScale(width, height, full) {
    const preferred = full ? 2 : Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
    const maxOutputWidth = 8192;
    const maxOutputHeight = full ? 16384 : 8192;
    const maxPixels = full ? 24000000 : 18000000;
    const byWidth = maxOutputWidth / Math.max(1, width);
    const byHeight = maxOutputHeight / Math.max(1, height);
    const byPixels = Math.sqrt(maxPixels / Math.max(1, width * height));
    const scale = Math.min(preferred, byWidth, byHeight, byPixels);
    return Number.isFinite(scale) && scale > 0 ? Math.max(0.15, scale) : 1;
  }

  function buildCaptureClone(full) {
    const source = els.captureTarget;
    const sourceRect = source.getBoundingClientRect();
    const clone = source.cloneNode(true);
    clone.classList.add('capture-export', full ? 'capture-full' : 'capture-screen');
    stripIds(clone);

    /* Saved images are clean chat screenshots, not phone mockups. */
    clone.querySelector('.phone-statusbar')?.remove();
    clone.querySelectorAll('.mockup-mark').forEach(mark => mark.remove());
    clone.style.setProperty('border', '0', 'important');
    clone.style.setProperty('border-radius', '0', 'important');
    clone.style.setProperty('box-shadow', 'none', 'important');

    applyDateVisibility(clone);
    applyTimeVisibility(clone);

    clone.style.setProperty('width', `${Math.ceil(sourceRect.width)}px`, 'important');
    clone.style.setProperty('max-width', 'none', 'important');
    clone.style.setProperty('transform', 'none', 'important');
    clone.style.setProperty('margin', '0', 'important');

    if (full) {
      clone.style.setProperty('height', 'auto', 'important');
      clone.style.setProperty('min-height', '0', 'important');
      clone.style.setProperty('max-height', 'none', 'important');
    } else {
      const statusHeight = source.querySelector('.phone-statusbar')?.getBoundingClientRect().height || 0;
      const exportHeight = Math.max(1, Math.ceil(sourceRect.height - statusHeight));
      clone.style.setProperty('height', `${exportHeight}px`, 'important');
      clone.style.setProperty('min-height', `${exportHeight}px`, 'important');
      clone.style.setProperty('max-height', `${exportHeight}px`, 'important');
    }

    const stage = document.createElement('div');
    stage.id = 'ccmCaptureStage';
    stage.style.width = `${Math.ceil(sourceRect.width)}px`;
    stage.appendChild(clone);
    document.body.appendChild(stage);

    const cloneScroll = clone.querySelector('.chat-scroll');
    if (cloneScroll) {
      if (full) {
        cloneScroll.style.setProperty('overflow', 'visible', 'important');
        cloneScroll.style.setProperty('height', 'auto', 'important');
        cloneScroll.style.setProperty('min-height', '0', 'important');
        cloneScroll.style.setProperty('max-height', 'none', 'important');
        cloneScroll.style.setProperty('flex', '0 0 auto', 'important');
        cloneScroll.scrollTop = 0;
      } else {
        cloneScroll.scrollTop = els.chatScroll.scrollTop;
      }
    }

    return { stage, clone, cloneScroll, sourceRect };
  }

  async function stabilizeFullHeight(clone, cloneScroll) {
    if (!cloneScroll) return;
    await nextFrame();

    const required = Math.max(
      cloneScroll.scrollHeight,
      cloneScroll.getBoundingClientRect().height,
      cloneScroll.querySelector('.message-list')?.scrollHeight || 0
    );
    cloneScroll.style.setProperty('height', `${Math.ceil(required + 4)}px`, 'important');
    cloneScroll.style.setProperty('flex-basis', `${Math.ceil(required + 4)}px`, 'important');
    clone.style.setProperty('height', 'auto', 'important');
    await nextFrame();
  }

  createCaptureCanvas = async function(full) {
    if (typeof html2canvas === 'undefined') throw new Error('캡처 라이브러리를 불러오지 못했습니다.');

    applyDateVisibility();
    applyTimeVisibility();
    await waitForFonts();
    const { stage, clone, cloneScroll } = buildCaptureClone(Boolean(full));

    try {
      await waitForImages(clone);
      await nextFrame();
      fitHeaderTitle(clone);
      await nextFrame();

      if (full) {
        await stabilizeFullHeight(clone, cloneScroll);
        fitHeaderTitle(clone);
        await nextFrame();
      }

      const rect = clone.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));

      if (full && cloneScroll) {
        const contentBottom = cloneScroll.getBoundingClientRect().bottom;
        const composerTop = clone.querySelector('.composer-bar')?.getBoundingClientRect().top || contentBottom;
        if (contentBottom > composerTop + 2) {
          throw new Error('전체 대화 높이 계산이 완료되지 않았습니다. 다시 저장해 주세요.');
        }
      }

      const scale = chooseScale(width, height, Boolean(full));
      const canvas = await html2canvas(clone, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width,
        height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        imageTimeout: 4000,
        removeContainer: true
      });

      canvas.dataset.captureMode = full ? 'full' : 'screen';
      canvas.dataset.captureScale = String(scale);
      canvas.dataset.cssWidth = String(width);
      canvas.dataset.cssHeight = String(height);
      return canvas;
    } finally {
      stage.remove();
    }
  };

  injectFinalPolishStyles();
  setupDateToggle();
  setupTimeToggle();

  const previousRenderPreview = renderPreview;
  renderPreview = function finalRenderPreview() {
    previousRenderPreview();
    applyDateVisibility();
    applyTimeVisibility();
    refreshTimeEditorValues();
  };

  const previousRenderAll = renderAll;
  renderAll = function finalRenderAll() {
    previousRenderAll();
    enhanceTimeEditors();
    applyDateVisibility();
    applyTimeVisibility();
  };

  /* Normalize older drafts/messages that predate manual timestamps. */
  state.messages.forEach(msg => {
    if (!isValidTime(msg.manualTime)) msg.manualTime = '';
  });
  state.originals.forEach(msg => {
    if (!isValidTime(msg.manualTime)) msg.manualTime = '';
  });
  regenerateTimes();
  renderAll();

  /* MOCKUP is strictly a preview aid and starts disabled. */
  if (els.mockupToggle) els.mockupToggle.checked = false;
  if (els.mockupMark) els.mockupMark.style.display = 'none';
})();
