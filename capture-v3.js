(() => {
  const DATE_KEY = 'chatCaptureShowDateV1';
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
    `;
    document.head.appendChild(style);
  }

  function applyDateVisibility() {
    const separator = els.captureTarget?.querySelector('.date-separator');
    const toggle = document.getElementById('dateSeparatorToggle');
    const visible = toggle ? toggle.checked : localStorage.getItem(DATE_KEY) !== '0';
    if (separator) separator.style.display = visible ? '' : 'none';
  }

  function setupDateToggle() {
    if (document.getElementById('dateSeparatorToggle')) {
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

  /* MOCKUP is strictly a preview aid and starts disabled. */
  if (els.mockupToggle) els.mockupToggle.checked = false;
  if (els.mockupMark) els.mockupMark.style.display = 'none';
})();
