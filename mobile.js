(() => {
  const mq = window.matchMedia('(max-width: 820px)');
  const editTab = document.getElementById('mobileEditTab');
  const previewTab = document.getElementById('mobilePreviewTab');
  const controls = document.querySelector('.controls-panel');
  const previewToolbar = document.querySelector('.preview-toolbar .preview-actions');
  if (!editTab || !previewTab || !controls) return;

  let currentView = sessionStorage.getItem('chatCaptureMobileView') || 'edit';

  function setView(view, options = {}) {
    currentView = view === 'preview' ? 'preview' : 'edit';
    document.body.classList.toggle('mobile-view-edit', currentView === 'edit');
    document.body.classList.toggle('mobile-view-preview', currentView === 'preview');
    editTab.classList.toggle('active', currentView === 'edit');
    previewTab.classList.toggle('active', currentView === 'preview');
    editTab.setAttribute('aria-selected', String(currentView === 'edit'));
    previewTab.setAttribute('aria-selected', String(currentView === 'preview'));
    sessionStorage.setItem('chatCaptureMobileView', currentView);
    if (options.top !== false) window.scrollTo({ top: 0, behavior: options.smooth ? 'smooth' : 'auto' });
    if (currentView === 'preview') requestAnimationFrame(() => {
      if (typeof renderPreview === 'function') renderPreview();
    });
  }

  function applyResponsiveState() {
    if (mq.matches) setView(currentView, { top: false });
    else {
      document.body.classList.remove('mobile-view-edit', 'mobile-view-preview');
      editTab.classList.remove('active');
      previewTab.classList.remove('active');
    }
  }

  editTab.addEventListener('click', () => setView('edit', { smooth: true }));
  previewTab.addEventListener('click', () => setView('preview', { smooth: true }));
  mq.addEventListener?.('change', applyResponsiveState);

  // Mobile-only quick actions so desktop header buttons do not consume screen space.
  const quick = document.createElement('div');
  quick.className = 'mobile-quick-actions';
  quick.innerHTML = `
    <button type="button" data-mobile-action="save">저장</button>
    <button type="button" data-mobile-action="load">불러오기</button>
    <button type="button" data-mobile-action="api">AI 연결</button>
  `;
  controls.insertBefore(quick, controls.firstChild);

  quick.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mobile-action]');
    if (!btn) return;
    const map = { save: 'saveDraftBtn', load: 'loadDraftBtn', api: 'apiSettingsBtn' };
    document.getElementById(map[btn.dataset.mobileAction])?.click();
  });

  if (previewToolbar && !document.getElementById('mobileCaptureFullBtn')) {
    const full = document.createElement('button');
    full.type = 'button';
    full.id = 'mobileCaptureFullBtn';
    full.className = 'btn primary mobile-only-action';
    full.textContent = '전체 대화 PNG';
    full.addEventListener('click', () => document.getElementById('captureFullBtn')?.click());
    previewToolbar.append(full);
  }

  // On mobile, file selection and textarea focus should stay in edit mode.
  controls.addEventListener('focusin', () => {
    if (mq.matches && currentView !== 'edit') setView('edit', { top: false });
  });

  // Keep the preview reachable after adding/editing messages without auto-switching away from typing.
  document.addEventListener('keydown', (e) => {
    if (!mq.matches) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      setView('preview', { smooth: true });
    }
  });

  applyResponsiveState();
})();
