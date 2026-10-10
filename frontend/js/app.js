/* Open Attic — main app (vanilla JS, no build step). */
(function () {
  'use strict';
  const OA = window.OA;
  const { api, isDemo, icon, esc, safeHref, hostOf, relativeTime, guessType, RESOURCE_TYPES, TYPE_ICON, TYPE_LABEL } = OA;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Animated scrolling (eased, cancellable) ---------- */
  let scrollRaf = 0;
  function smoothScrollTo(targetY, dur) {
    cancelAnimationFrame(scrollRaf);
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (reduceMotion() || Math.abs(dist) < 2) { window.scrollTo({ top: targetY, behavior: 'instant' }); return; }
    dur = dur || Math.min(1500, Math.max(800, Math.abs(dist) * 0.9));
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const stopEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    const stop = () => { cancelAnimationFrame(scrollRaf); cleanup(); };
    const cleanup = () => stopEvents.forEach((ev) => window.removeEventListener(ev, stop));
    stopEvents.forEach((ev) => window.addEventListener(ev, stop, { passive: true }));
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      window.scrollTo({ top: startY + dist * ease(p), behavior: 'instant' });
      if (p < 1) scrollRaf = requestAnimationFrame(step); else cleanup();
    })(t0);
  }
  function scrollToEl(el, gap) {
    const bar = $('#topbar').offsetHeight || 0;
    const y = el.getBoundingClientRect().top + window.scrollY - bar - (gap == null ? 0 : gap);
    smoothScrollTo(Math.max(0, y));
  }

  const THEME_KEY = 'open-attic:theme';
  const VIEW_KEY = 'open-attic:view';
  const RAIL_KEY = 'open-attic:rail';
  const THEME_COLOR = { light: '#eae2d6', dark: '#1f1712' };

  const state = {
    resources: [],
    status: 'loading', // loading | ready | error
    query: '',
    type: 'All',
    subject: 'All',
    tab: 'all',
    sort: 'newest',
    view: 'grid',
    railOpen: true,
    confirmId: null,
  };
  let popAnim = { id: null, kind: '' }; // one-shot "pop" animation after a toggle

  OA.hydrateIcons();

  /* ============================================================
     Theme
     ============================================================ */
  function currentTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function paintThemeBtn(spin) {
    const t = currentTheme();
    const btn = $('#themeBtn');
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', t === 'dark' ? 'Light theme' : 'Dark theme');
    btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 20, spin ? 'spin-once' : '');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[t]);
  }
  $('#themeBtn').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.add('theme-fade');
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    paintThemeBtn(true);
    setTimeout(() => document.documentElement.classList.remove('theme-fade'), 450);
  });
  paintThemeBtn(false);

  /* ============================================================
     Intro splash
     ============================================================ */
  if (document.documentElement.dataset.intro) {
    try { sessionStorage.setItem('open-attic:intro-seen', '1'); } catch (e) {}
    setTimeout(() => {
      delete document.documentElement.dataset.intro;
      $('#intro').remove();
    }, 1050);
  } else {
    $('#intro').remove();
  }

  /* ============================================================
     Toasts
     ============================================================ */
  function toast(text, tone) {
    const el = document.createElement('p');
    el.className = 'toast toast-' + (tone || 'ok');
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
    }, 3800);
  }

  /* ============================================================
     Data loading
     ============================================================ */
  let firstLoad = true;
  async function load() {
    state.status = 'loading';
    render();
    try {
      const [rows] = await Promise.all([api.list(), firstLoad ? new Promise((r) => setTimeout(r, reduceMotion() ? 0 : 450)) : null]);
      state.resources = rows;
      state.status = 'ready';
    } catch (e) {
      state.status = 'error';
    }
    firstLoad = false;
    render();
  }

  const findRes = (id) => state.resources.find((r) => r.id === id);

  /* ============================================================
     Mutations (optimistic with rollback)
     ============================================================ */
  async function patch(id, changes, failMessage) {
    const prev = findRes(id);
    const prevCopy = prev && Object.assign({}, prev);
    state.resources = state.resources.map((r) => (r.id === id ? Object.assign({}, r, changes) : r));
    render();
    try {
      const updated = await api.update(id, changes);
      if (updated) {
        state.resources = state.resources.map((r) => (r.id === id ? Object.assign({}, r, updated) : r));
        render();
      }
    } catch (e) {
      if (prevCopy) state.resources = state.resources.map((r) => (r.id === id ? prevCopy : r));
      render();
      toast(failMessage, 'error');
    }
  }

  function toggleBookmark(r) {
    popAnim = { id: r.id, kind: r.bookmarked ? '' : 'bm' };
    patch(r.id, { bookmarked: !r.bookmarked }, 'Could not update saved status. Try again.');
    toast(r.bookmarked ? 'Removed from saved' : 'Saved for later');
  }

  async function openResource(r) {
    const now = new Date().toISOString();
    state.resources = state.resources.map((x) => (x.id === r.id ? Object.assign({}, x, { lastAccessed: now }) : x));
    api.update(r.id, { lastAccessed: now }).catch(() => undefined);
    render();
    if (!r.isFile) return;
    // Open a blank tab synchronously so browsers don't block the later signed-URL navigation.
    const win = window.open('about:blank', '_blank');
    if (!win) { toast('Your browser blocked the new tab. Allow pop-ups for Open Attic and try again.', 'error'); return; }
    try {
      win.location.href = await api.fileUrl(r.id);
    } catch (e) {
      win.close();
      toast(e instanceof Error ? e.message : 'Could not open this uploaded file.', 'error');
    }
  }

  async function removeResource(r) {
    state.confirmId = null;
    const li = $('#grid .card-wrap[data-id="' + cssEsc(r.id) + '"]');
    if (li) li.classList.add('leaving');
    const wait = new Promise((res) => setTimeout(res, reduceMotion() ? 0 : 280));
    try {
      await Promise.all([api.remove(r.id), wait]);
      state.resources = state.resources.filter((x) => x.id !== r.id);
      render();
      toast('Resource removed');
    } catch (e) {
      if (li) li.classList.remove('leaving');
      render();
      toast('Could not remove that resource. Try again.', 'error');
    }
  }

  async function addResource(input) {
    const created = await api.create(input);
    state.resources = [created].concat(state.resources);
    popAnim = { id: created.id, kind: '' };
    resetFilters(true);
    closeModal();
    toast('Added “' + created.title + '”');
  }

  /* ============================================================
     Derived data
     ============================================================ */
  function subjectsList() {
    const counts = new Map();
    state.resources.forEach((r) => counts.set(r.subject, (counts.get(r.subject) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }
  function filtered() {
    const tokens = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = state.resources.filter((r) => {
      if (state.type !== 'All' && r.type !== state.type) return false;
      if (state.subject !== 'All' && r.subject !== state.subject) return false;
      if (state.tab === 'saved' && !r.bookmarked) return false;
      if (!tokens.length) return true;
      const hay = [r.title, r.description, r.subject, r.topic, r.type, TYPE_LABEL[r.type]].concat(r.tags).join(' ').toLowerCase();
      return tokens.every((t) => hay.indexOf(t) !== -1);
    });
    const time = (s) => (s ? new Date(s).getTime() : 0);
    return list.sort((a, b) => {
      if (state.sort === 'title') return a.title.localeCompare(b.title);
      if (state.sort === 'opened') return time(b.lastAccessed) - time(a.lastAccessed) || time(b.createdAt) - time(a.createdAt);
      return time(b.createdAt) - time(a.createdAt);
    });
  }
  const hasFilters = () => state.query.trim() !== '' || state.type !== 'All' || state.subject !== 'All' || state.tab !== 'all';
  function resetFilters(silentFocus) {
    state.query = ''; state.type = 'All'; state.subject = 'All'; state.tab = 'all';
    $('#q').value = '';
    if (typeof closeSuggest === 'function') closeSuggest();
    render();
  }
  const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));

  /* ============================================================
     Rendering
     ============================================================ */
  function render() {
    const ready = state.status === 'ready';
    const list = ready ? filtered() : [];
    const total = state.resources.length;
    const savedCount = state.resources.filter((r) => r.bookmarked).length;
    const subjects = subjectsList();

    renderHero(ready, total, subjects.length);
    renderContinue(ready);
    renderRail(ready, total, subjects);
    renderTypeTiles();
    paintRail();

    // toolbar
    $('#cnt-all').textContent = total;
    $('#cnt-saved').textContent = savedCount;
    $$('#tabSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
    $$('#viewSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('#sort').value = state.sort;

    // results header
    const noun = total === 1 ? 'resource' : 'resources';
    $('#results-h').textContent =
      state.status === 'loading' ? 'Loading your library' : hasFilters() ? list.length + ' of ' + total + ' ' + noun : total + ' ' + noun;
    $('#clearFilters').hidden = !(hasFilters() && ready);

    // panels
    $('#notice').hidden = state.status !== 'error';
    $('#skeleton').hidden = state.status !== 'loading';
    $('#grid').hidden = !(ready && list.length > 0);
    $('#empty').hidden = !(ready && list.length === 0);
    $('#grid').dataset.view = state.view;
    $('#skeleton').dataset.view = state.view;

    if (ready && list.length === 0) renderEmpty(total);
    if (ready) renderGrid(list);
    popAnim = { id: null, kind: '' };

    syncSearchAdorn();
  }

  /* ---- hero stats ---- */
  function renderHero(ready, total, nSubjects) {
    const el = $('#heroStats');
    el.hidden = !ready;
    if (!ready) return;
    el.textContent = total + ' ' + (total === 1 ? 'resource' : 'resources') + ' across ' + nSubjects + ' ' + (nSubjects === 1 ? 'subject' : 'subjects') + '. Keep your best finds together in collections.';
  }

  /* ---- continue strip: big tiles ---- */
  function renderContinue(ready) {
    const incomplete = state.resources.slice();
    const recents = incomplete
      .filter((r) => r.lastAccessed)
      .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
      .slice(0, 3);
    const hasRecents = recents.length > 0;
    // top up to three tiles with the newest things not opened yet
    const fill = incomplete
      .filter((r) => !recents.includes(r))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3 - recents.length);
    const tiles = recents.concat(fill);
    const sec = $('#continue');
    sec.hidden = !(ready && tiles.length > 0);
    if (sec.hidden) return;
    $('#continue-h').textContent = hasRecents ? 'Pick up where you left off' : 'Start with something new';
    $('#continueSub').textContent = hasRecents ? 'Jump straight back into what you opened last.' : 'Your latest additions are waiting. Open one to begin.';
    $('#continueList').innerHTML = tiles
      .map((r, i) => {
        const inner =
          '<span class="tile-top"><span class="tile-icon">' + icon(TYPE_ICON[r.type], 26) + '</span><span class="tile-type">' + esc(TYPE_LABEL[r.type]) + '</span></span>' +
          '<span class="tile-body"><span class="tile-where">' + esc(r.subject) + (r.topic ? ' / ' + esc(r.topic) : '') + '</span>' +
          '<strong class="tile-title">' + esc(r.title) + '</strong>' +
          (r.description ? '<span class="tile-desc">' + esc(r.description) + '</span>' : '') + '</span>' +
          '<span class="tile-foot"><span class="tile-go">' + (r.lastAccessed ? 'Resume' : 'Open') + icon('arrow-right', 18) + '</span></span>' +
          '<span class="tile-mark" aria-hidden="true">' + icon(TYPE_ICON[r.type], 150) + '</span>';
        const cls = 'tile';
        return '<li data-type="' + esc(r.type) + '" style="--i:' + i + '">' + (r.isFile
          ? '<a class="' + cls + '" href="#" role="button" data-id="' + esc(r.id) + '">' + inner + '</a>'
          : '<a class="' + cls + '" href="' + esc(safeHref(r.url)) + '" target="_blank" rel="noopener noreferrer" data-id="' + esc(r.id) + '">' + inner + '</a>') + '</li>';
      })
      .join('');
  }
  // Tiles animate in the first time the section scrolls into view.
  (function () {
    const sec = $('#continue');
    if (!('IntersectionObserver' in window) || reduceMotion()) { sec.dataset.reveal = 'done'; return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      sec.dataset.reveal = 'in';
      setTimeout(() => { sec.dataset.reveal = 'done'; }, 1400);
    }, { threshold: 0.2 });
    io.observe(sec);
  })();
  $('#continueList').addEventListener('click', (e) => {
    const a = e.target.closest('a.tile[data-id]');
    if (!a) return;
    const r = findRes(a.dataset.id);
    if (!r) return;
    if (r.isFile) e.preventDefault();
    openResource(r);
  });

  /* ---- rail ---- */
  function railItem(key, label, count, pressed, type, iconName) {
    return (
      '<li' + (type ? ' data-type="' + esc(type) + '"' : '') + '><button type="button" class="rail-item" data-k="' + esc(key) + '" aria-pressed="' + pressed + '">' +
      (iconName ? '<span class="rail-icon">' + icon(iconName, 15) + '</span>' : '') +
      '<span class="rail-label">' + esc(label) + '</span><span class="rail-count">' + count + '</span></button></li>'
    );
  }
  function renderRail(ready, total, subjects) {
    const rail = $('#rail');
    const active = document.activeElement && rail.contains(document.activeElement) ? document.activeElement.dataset.k : null;

    let html =
      '<nav aria-labelledby="rail-subject"><div class="rail-head"><h2 id="rail-subject">Subject</h2>' +
      '<button type="button" class="icon-btn rail-close" data-rail-toggle aria-label="Hide subjects sidebar" title="Hide sidebar">' + icon('chevron-left', 18) + '</button></div><ul class="rail-list">' +
      railItem('subject:All', 'All subjects', total, state.subject === 'All') +
      subjects.map(([name, n]) => railItem('subject:' + name, name, n, state.subject === name)).join('') +
      '</ul></nav>';

    rail.innerHTML = html;
    if (active) {
      const again = $$('[data-k]', rail).find((b) => b.dataset.k === active);
      if (again) again.focus({ preventScroll: true });
    }
  }
  /* ---- foldable sidebar ---- */
  function paintRail() {
    const open = state.railOpen;
    const layout = $('.layout');
    if (layout) layout.dataset.rail = open ? 'open' : 'closed';
    const t = $('#railToggle');
    if (t) {
      t.setAttribute('aria-expanded', String(open));
      t.title = open ? 'Hide subjects sidebar' : 'Show subjects sidebar';
    }
    const note = $('#railNote');
    if (note) {
      const filtered = !open && state.subject !== 'All';
      note.hidden = !filtered;
      note.textContent = filtered ? state.subject : '';
    }
  }
  function setRail(open, focusToggle) {
    state.railOpen = open;
    try { localStorage.setItem(RAIL_KEY, open ? 'open' : 'closed'); } catch (err) {}
    paintRail();
    if (focusToggle) { const t = $('#railToggle'); if (t) t.focus({ preventScroll: true }); }
    else if (open) { const first = $('#rail .rail-item[aria-pressed="true"]') || $('#rail .rail-item'); if (first) first.focus({ preventScroll: true }); }
  }
  $('#railToggle').addEventListener('click', () => setRail(!state.railOpen, false));
  $('#rail').addEventListener('click', (e) => {
    if (e.target.closest('[data-rail-toggle]')) setRail(false, true);
  });

  let railMeterReady = false;

  $('#rail').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const [kind, ...rest] = b.dataset.k.split(':');
    const val = rest.join(':');
    if (kind === 'type') state.type = state.type === val ? 'All' : val;
    else state.subject = state.subject === val ? 'All' : val;
    render();
  });

  /* ---- resource type tiles (Explore) ---- */
  const TILE_TYPES = [['Image', 'Images'], ['PDF', 'PDFs'], ['Word', 'Word'], ['PPT', 'PPT'], ['Link', 'Git Repos & Web Links']];
  // Uniform thumbnail system: every category uses the same frame, canvas and
  // line-art treatment; only the illustration and category accent vary.
  function typeTileThumbnail(type) {
    const art = {
      Image: '<rect x="16" y="11" width="56" height="40" rx="5"/><circle cx="58" cy="22" r="4"/><path d="m20 44 13-14 9 9 7-7 19 15"/>',
      PDF: '<path d="M28 9h22l11 11v31H28z"/><path d="M50 9v12h11M35 29h19M35 35h19M35 41h12"/><path d="M24 17v34"/>',
      Word: '<path d="M28 9h22l11 11v31H28z"/><path d="M50 9v12h11M35 27h19M35 33h19"/><path d="m35 39 3 7 4-7 4 7 3-7"/>',
      PPT: '<rect x="17" y="12" width="54" height="38" rx="5"/><path d="M24 21h25M24 26h17"/><rect x="25" y="33" width="8" height="11" rx="1.5"/><rect x="38" y="29" width="8" height="15" rx="1.5"/><rect x="51" y="24" width="8" height="20" rx="1.5"/>',
      Link: '<path d="M36 36 31 41a9 9 0 0 1-13-13l9-9a9 9 0 0 1 13 0"/><path d="m52 26 5-5a9 9 0 0 1 13 13l-9 9a9 9 0 0 1-13 0"/><path d="m32 31 24 0"/>',
    }[type] || '';
    return '<span class="type-tile-thumb" aria-hidden="true"><svg viewBox="0 0 88 62" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + art + '</svg></span>';
  }
  function renderTypeTiles() {
    const box = $('#typeTiles');
    const active = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset.type : null;
    const counts = {};
    state.resources.forEach((r) => { counts[r.type] = (counts[r.type] || 0) + 1; });
    box.innerHTML = TILE_TYPES.map(([t, label]) =>
      '<button type="button" class="type-tile" data-type="' + t + '" aria-pressed="' + (state.type === t) + '">' +
      typeTileThumbnail(t) +
      '<span class="type-tile-label">' + esc(label) + '</span>' +
      '<span class="type-tile-count">' + (counts[t] || 0) + '</span></button>'
    ).join('');
    if (active) { const again = $('[data-type="' + active + '"]', box); if (again) again.focus({ preventScroll: true }); }
  }
  $('#typeTiles').addEventListener('click', (e) => {
    const b = e.target.closest('.type-tile');
    if (!b) return;
    state.type = state.type === b.dataset.type ? 'All' : b.dataset.type;
    render();
  });

  /* ---- empty state ---- */
  function renderEmpty(total) {
    $('#empty').innerHTML =
      icon('bookmark', 28) +
      (total === 0
        ? '<h3>Your attic is empty</h3>' +
          '<button type="button" class="btn btn-solid" data-act="add">' + icon('plus', 18) + 'Add resource</button>'
        : '<h3>Nothing matches</h3>' +
          '<button type="button" class="btn btn-outline" data-act="clear">Clear filters</button>');
  }
  $('#empty').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'add') openModal(b);
    else resetFilters();
  });

  /* ---- cards ---- */
  function cardHTML(r, pop) {
    const confirming = state.confirmId === r.id;
    const title = r.isFile
      ? '<button type="button" class="resource-title-button" data-action="open">' + esc(r.title) + '</button>'
      : '<a href="' + esc(safeHref(r.url)) + '" target="_blank" rel="noopener noreferrer" data-action="open">' + esc(r.title) + '</a>';
    const openBtn = r.isFile
      ? '<button type="button" class="btn btn-sm btn-solid" data-action="open" aria-label="Open ' + esc(r.title) + '">Open ' + icon('external-link', 14) + '</button>'
      : '<a class="btn btn-sm btn-solid" href="' + esc(safeHref(r.url)) + '" target="_blank" rel="noopener noreferrer" data-action="open" aria-label="Open ' + esc(r.title) + ' in a new tab">Open ' + icon('external-link', 14) + '</a>';

    const foot = confirming
      ? '<div class="confirm" role="group" aria-label="Remove ' + esc(r.title) + '?"><span>Remove this resource?</span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="keep">Keep</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-action="delete">Remove</button></div>'
      : '<div class="card-actions">' +
        '<button type="button" class="icon-btn icon-btn-quiet" data-action="ask-delete" aria-label="Remove ' + esc(r.title) + '" title="Remove">' + icon('trash', 17) + '</button>' +
        '</div>' + openBtn;
    const meta = '<p class="card-meta"><span class="host">' + esc(hostOf(r.url)) + '</span>' + (r.lastAccessed ? '<span class="opened">Opened ' + esc(relativeTime(r.lastAccessed)) + '</span>' : '') + '</p>';

    return (
      '<span class="card-tab">' + icon(TYPE_ICON[r.type], 15) + esc(TYPE_LABEL[r.type]) + '</span>' +
      '<article class="card">' +
      '<div class="card-head">' +
      '<h3 class="card-title"' + (r.description ? ' title="' + esc(r.description) + '"' : '') + '>' + title + '</h3>' +
      '<button type="button" class="icon-btn' + (r.bookmarked ? ' is-on' : '') + (pop === 'bm' ? ' pop' : '') + '" data-action="bookmark" aria-pressed="' + r.bookmarked +
      '" aria-label="' + (r.bookmarked ? 'Remove ' : 'Save ') + esc(r.title) + (r.bookmarked ? ' from saved' : '') + '">' + icon('bookmark', 18) + '</button></div>' +
      (confirming ? '' : meta) +
      '<div class="card-foot">' + foot + '</div></article>'
    );
  }

  const cardCache = new Map(); // id -> { el, sig }
  function renderGrid(list) {
    const grid = $('#grid');
    const act = document.activeElement;
    const focusInfo = act && grid.contains(act) && act.dataset.action
      ? { id: act.closest('.card-wrap').dataset.id, action: act.dataset.action, tag: act.dataset.tag }
      : null;

    const keep = new Set(list.map((r) => r.id));
    cardCache.forEach((c, id) => { if (!keep.has(id)) { c.el.remove(); cardCache.delete(id); } });

    list.forEach((r, i) => {
      const pop = popAnim.id === r.id ? popAnim.kind : '';
      const sig = JSON.stringify([r, state.confirmId === r.id, pop, relativeTime(r.lastAccessed)]);
      let c = cardCache.get(r.id);
      if (!c) {
        const el = document.createElement('li');
        el.className = 'card-wrap enter';
        el.dataset.id = r.id;
        el.style.setProperty('--i', Math.min(i, 14));
        el.addEventListener('animationend', (ev) => { if (ev.target === el) el.classList.remove('enter'); });
        c = { el: el, sig: '' };
        cardCache.set(r.id, c);
      }
      if (c.sig !== sig) {
        c.el.dataset.type = r.type;
        c.el.innerHTML = cardHTML(r, pop);
        $('.card', c.el).setAttribute('aria-labelledby', 't-' + r.id);
        $('.card-title', c.el).id = 't-' + r.id;
        c.sig = sig;
      }
      if (grid.children[i] !== c.el) grid.insertBefore(c.el, grid.children[i] || null);
    });

    if (state.confirmId) {
      const k = $('.card-wrap[data-id="' + cssEsc(state.confirmId) + '"] [data-action="keep"]', grid);
      if (k) k.focus({ preventScroll: true });
    } else if (focusInfo) {
      const li = $('.card-wrap[data-id="' + cssEsc(focusInfo.id) + '"]', grid);
      if (li) {
        const sel = '[data-action="' + focusInfo.action + '"]';
        const target = focusInfo.action === 'tag' ? null : $(sel, li) || $('[data-action="ask-delete"]', li);
        if (target) target.focus({ preventScroll: true });
      }
    }
  }

  $('#grid').addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const li = t.closest('.card-wrap');
    const r = li && findRes(li.dataset.id);
    if (!r) return;
    switch (t.dataset.action) {
      case 'open':
        if (r.isFile) e.preventDefault();
        openResource(r);
        break;
      case 'bookmark': toggleBookmark(r); break;
      case 'ask-delete': state.confirmId = r.id; render(); break;
      case 'keep': {
        state.confirmId = null; render();
        const b = $('.card-wrap[data-id="' + cssEsc(r.id) + '"] [data-action="ask-delete"]');
        if (b) b.focus({ preventScroll: true });
        break;
      }
      case 'delete': removeResource(r); break;
      case 'tag':
        state.query = t.dataset.tag;
        $('#q').value = state.query;
        render();
        scrollToEl($('#library'), 8);
        break;
    }
  });

  /* ============================================================
     Search, toolbar
     ============================================================ */
  const q = $('#q');
  const sgBox = $('#suggest');
  const searchForm = $('#searchForm');
  let sgItems = [];     // matching resources currently shown
  let sgTotal = 0;      // total matches (may exceed what is shown)
  let sgActive = -1;    // keyboard highlight; sgItems.length means the "see all" row

  const tokensOf = (text) => text.toLowerCase().split(/\s+/).filter(Boolean);
  const hayOf = (r) => [r.title, r.description, r.subject, r.topic, r.type, TYPE_LABEL[r.type]].concat(r.tags).join(' ').toLowerCase();
  function highlight(text, tokens) {
    if (!tokens.length) return esc(text);
    const re = new RegExp('(' + tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    return text.split(re).map((part, i) => (i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part))).join('');
  }
  function computeSuggestions(text) {
    const tokens = tokensOf(text);
    if (!tokens.length) return { items: [], total: 0, tokens };
    const scored = state.resources
      .filter((r) => { const h = hayOf(r); return tokens.every((t) => h.indexOf(t) !== -1); })
      .map((r) => {
        const title = r.title.toLowerCase();
        let score = 1;
        if (tokens.every((t) => title.indexOf(t) !== -1)) score += 2;
        if (title.indexOf(tokens[0]) === 0) score += 2;
        if (r.bookmarked) score += 0.5;
        return { r, score };
      })
      .sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title));
    return { items: scored.slice(0, 6).map((x) => x.r), total: scored.length, tokens };
  }
  function renderSuggestions() {
    const text = q.value.trim();
    if (!text || state.status !== 'ready') return closeSuggest();
    const { items, total, tokens } = computeSuggestions(text);
    sgItems = items; sgTotal = total; sgActive = -1;
    let html = '<p class="sg-head" aria-hidden="true">' + (total ? 'Related resources' : 'No matches') + '</p>';
    if (!total) {
      html += '<p class="sg-empty">Nothing in your attic matches “' + esc(text) + '”. Try a subject, topic or tag.</p>';
    } else {
      html += items.map((r, i) =>
        '<div class="sg-item" role="option" id="sg-' + i + '" data-i="' + i + '" data-type="' + esc(r.type) + '" aria-selected="false" style="--i:' + i + '">' +
        '<span class="sg-icon">' + icon(TYPE_ICON[r.type], 18) + '</span>' +
        '<span class="sg-text"><span class="sg-title">' + highlight(r.title, tokens) + '</span>' +
        '<span class="sg-meta">' + esc(r.subject) + (r.topic ? ' / ' + esc(r.topic) : '') + ' · ' + esc(TYPE_LABEL[r.type]) + '</span></span>' +
        '<span class="sg-go">' + icon('corner-down-left', 15) + '</span></div>'
      ).join('');
      html += '<div class="sg-all" role="option" id="sg-all" data-all="1" aria-selected="false" style="--i:' + items.length + '">' +
        '<span>See all ' + total + ' ' + (total === 1 ? 'result' : 'results') + ' for “' + esc(text) + '”</span>' + icon('arrow-right', 16) + '</div>';
    }
    sgBox.innerHTML = html;
    sgBox.hidden = false;
    q.setAttribute('aria-expanded', 'true');
    q.removeAttribute('aria-activedescendant');
  }
  function closeSuggest() {
    sgBox.hidden = true; sgActive = -1;
    q.setAttribute('aria-expanded', 'false');
    q.removeAttribute('aria-activedescendant');
  }
  function setActive(i) {
    const rows = $$('.sg-item, .sg-all', sgBox);
    if (!rows.length) return;
    sgActive = (i + rows.length) % rows.length;
    rows.forEach((el, k) => { el.classList.toggle('is-active', k === sgActive); el.setAttribute('aria-selected', String(k === sgActive)); });
    q.setAttribute('aria-activedescendant', rows[sgActive].id);
    rows[sgActive].scrollIntoView({ block: 'nearest' });
  }
  function syncSearchAdorn() {
    $('#searchClear').hidden = !q.value;
    $('#searchKbd').hidden = !!q.value;
  }

  /** Apply the typed text as a filter and bring the library into view. */
  function commitSearch(text) {
    state.query = text.trim();
    q.value = state.query;
    closeSuggest(); syncSearchAdorn(); render();
    if (state.query) scrollToEl($('#library'), 8);
  }
  /** Jump to one specific resource from the dropdown. */
  function chooseResource(r) {
    state.type = 'All'; state.subject = 'All'; state.tab = 'all';
    state.query = r.title; q.value = r.title;
    closeSuggest(); syncSearchAdorn(); render();
    scrollToEl($('#library'), 8);
    setTimeout(() => {
      const c = cardCache.get(r.id);
      if (c) { c.el.classList.remove('flash'); void c.el.offsetWidth; c.el.classList.add('flash'); setTimeout(() => c.el.classList.remove('flash'), 2200); }
    }, reduceMotion() ? 0 : 750);
  }

  q.addEventListener('input', () => {
    syncSearchAdorn();
    renderSuggestions();
    if (!q.value.trim() && state.query) { state.query = ''; render(); } // emptied the box: drop the filter
  });
  q.addEventListener('focus', () => { if (q.value.trim()) renderSuggestions(); });
  q.addEventListener('keydown', (e) => {
    const open = !sgBox.hidden;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) renderSuggestions(); setActive(sgActive + 1); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setActive(sgActive - 1); }
    else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); closeSuggest(); }
      else if (q.value) { q.value = ''; state.query = ''; syncSearchAdorn(); render(); }
    }
  });
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const open = !sgBox.hidden;
    if (open && sgActive >= 0 && sgActive < sgItems.length) chooseResource(sgItems[sgActive]);
    else commitSearch(q.value);
  });
  sgBox.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
  sgBox.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.sg-item, .sg-all');
    if (!row) return;
    const rows = $$('.sg-item, .sg-all', sgBox);
    const k = rows.indexOf(row);
    if (k !== sgActive) setActive(k);
  });
  sgBox.addEventListener('click', (e) => {
    const row = e.target.closest('.sg-item, .sg-all');
    if (!row) return;
    if (row.dataset.all) commitSearch(q.value);
    else chooseResource(sgItems[Number(row.dataset.i)]);
  });
  document.addEventListener('mousedown', (e) => { if (!searchForm.contains(e.target)) closeSuggest(); });
  $('#searchClear').addEventListener('click', () => {
    q.value = ''; state.query = ''; closeSuggest(); syncSearchAdorn(); render(); q.focus();
  });
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      smoothScrollTo(0);
      q.focus({ preventScroll: true });
    }
  });

  /* Explore: animated scroll straight to the "Explore" section (skips past "Pick up where you left off") */
  $('#exploreBtn').addEventListener('click', () => scrollToEl($('#library'), 8));

  $('#tabSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) { state.tab = b.dataset.tab; render(); }
  });
  $('#viewSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    state.view = b.dataset.view;
    try { localStorage.setItem(VIEW_KEY, state.view); } catch (err) {}
    render();
  });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('#clearFilters').addEventListener('click', () => resetFilters());
  $('#retryBtn').addEventListener('click', load);

  /* ============================================================
     Footer, scroll effects
     ============================================================ */
  const topbar = $('#topbar');
  const toTop = $('#toTop');
  let ticking = false;
  function onScroll() {
    const y = window.scrollY || 0;
    topbar.classList.toggle('is-scrolled', y > 8);
    toTop.hidden = y < 700;
    ticking = false;
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();

  /* ============================================================
     Add-resource modal: type first, then choose link vs upload
     ============================================================ */
  const modal = $('#modal');
  const dialog = $('#dialog');
  const form = $('#addForm');
  const f = {
    title: $('#f-title'), url: $('#f-url'), file: $('#f-file'), subject: $('#f-subject'),
    topic: $('#f-topic'), desc: $('#f-desc'), tags: $('#f-tags'),
  };
  const resourceDetails = $('#resourceDetails');
  const linkSourceField = $('#linkSourceField');
  const fileSourceField = $('#fileSourceField');
  const fileDropZone = $('#fileDropZone');
  const fileSelection = $('#fileSelection');
  const fileDropHint = $('#fileDropHint');
  const fileError = $('#f-file-err');
  let modalType = '';
  let sourceMode = '';
  let opener = null;
  let submitting = false;

  const ACCEPT_BY_TYPE = {
    Image: '.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.tif,.tiff,.avif',
    PDF: '.pdf',
    Word: '.doc,.docx',
    PPT: '.ppt,.pptx',
    Link: '',
  };
  const FILE_KIND_LABEL = { Image: 'image', PDF: 'PDF', Word: 'Word document', PPT: 'PowerPoint file' };

  // The type picker is the first step and deliberately starts unselected.
  $('#typePicker').innerHTML = RESOURCE_TYPES.map(
    (t) => '<label class="type-opt" data-type="' + t + '"><input type="radio" name="resource-type" value="' + t + '"><span>' + icon(TYPE_ICON[t], 16) + esc(TYPE_LABEL[t]) + '</span></label>'
  ).join('');

  function setSourceMode(mode, clearPrevious = true) {
    if (!modalType) return;
    if (modalType === 'Link') mode = 'link';
    sourceMode = mode;
    linkSourceField.hidden = mode !== 'link';
    fileSourceField.hidden = mode !== 'file';
    $('#methodLinkBtn').setAttribute('aria-pressed', String(mode === 'link'));
    $('#methodFileBtn').setAttribute('aria-pressed', String(mode === 'file'));
    $('#methodFileBtn').disabled = modalType === 'Link';
    $('#sourceMethodHint').textContent = modalType === 'Link'
      ? 'Git repositories and web links are added using a URL.'
      : (mode === 'file' ? 'Drop a file into the box below, or browse to select it.' : 'Paste the direct URL for this resource.');
    if (clearPrevious) {
      if (mode === 'link') {
        f.file.value = '';
        updateFileSelection();
      } else {
        f.url.value = '';
        showErr('f-url-err', f.url, '');
      }
    }
    if (mode === 'file') f.file.accept = ACCEPT_BY_TYPE[modalType] || ACCEPT_BY_TYPE.Image;
  }

  function setType(t) {
    const previousType = modalType;
    modalType = t;
    if (previousType && previousType !== t) {
      // A file selected for one category must not silently carry over into another.
      f.file.value = '';
      f.url.value = '';
      fileDropZone.classList.remove('has-file', 'has-error');
      fileSelection.textContent = 'No file selected';
      showErr('f-url-err', f.url, '');
      showErr('f-file-err', f.file, '');
    }
    $$('#typePicker input').forEach((i) => { i.checked = i.value === t; });
    resourceDetails.hidden = !t;
    $('#methodFileBtn').disabled = t === 'Link';
    f.file.accept = ACCEPT_BY_TYPE[t] || ACCEPT_BY_TYPE.Image;
    fileDropHint.textContent = t === 'Link'
      ? 'Use a URL for Git repositories and websites.'
      : 'Accepted: ' + ({ Image: 'JPG, PNG, WEBP, GIF, SVG and other images', PDF: 'PDF files', Word: 'DOC and DOCX files', PPT: 'PPT and PPTX files' }[t] || 'supported files') + '.';
    const preferredMode = t === 'Link' ? 'link' : 'file';
    setSourceMode(preferredMode, true);
    showErr('f-file-err', f.file, '');
    $('#formError').hidden = true;
  }
  $('#typePicker').addEventListener('change', (e) => {
    if (e.target.name === 'resource-type') setType(e.target.value);
  });
  $('#methodLinkBtn').addEventListener('click', () => setSourceMode('link'));
  $('#methodFileBtn').addEventListener('click', () => { if (modalType !== 'Link') setSourceMode('file'); });

  function showErr(id, input, msg) {
    const p = $('#' + id);
    if (!p) return;
    p.hidden = !msg;
    p.textContent = msg || '';
    if (input && input.setAttribute) {
      if (msg) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', id); }
      else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
    }
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(1)) + ' ' + units[i];
  }
  function fileTypeFromName(name) {
    const n = String(name || '').toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg|bmp|tiff?|avif)$/.test(n)) return 'Image';
    if (/\.pdf$/.test(n)) return 'PDF';
    if (/\.(doc|docx)$/.test(n)) return 'Word';
    if (/\.(ppt|pptx)$/.test(n)) return 'PPT';
    return '';
  }
  function updateFileSelection() {
    const file = f.file.files && f.file.files[0];
    fileDropZone.classList.toggle('has-file', Boolean(file));
    if (!file) {
      fileDropZone.classList.remove('has-error');
      fileSelection.textContent = 'No file selected';
      showErr('f-file-err', f.file, '');
      return;
    }
    const inferredType = fileTypeFromName(file.name);
    fileSelection.textContent = file.name + ' · ' + formatBytes(file.size);
    if (inferredType && modalType && inferredType !== modalType) {
      fileDropZone.classList.add('has-error');
      showErr('f-file-err', f.file, 'This file looks like a ' + (FILE_KIND_LABEL[inferredType] || inferredType) + ', but you selected ' + TYPE_LABEL[modalType] + '. Change the type or choose a matching file.');
    } else if (!inferredType) {
      fileDropZone.classList.add('has-error');
      showErr('f-file-err', f.file, 'This file type is not supported. Choose an image, PDF, Word document, or PPT file.');
    } else {
      fileDropZone.classList.remove('has-error');
      showErr('f-file-err', f.file, '');
    }
  }
  f.file.addEventListener('change', updateFileSelection);
  ['dragenter', 'dragover'].forEach((eventName) => fileDropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.add('is-dragging');
  }));
  ['dragleave', 'dragend'].forEach((eventName) => fileDropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    if (!e.relatedTarget || !fileDropZone.contains(e.relatedTarget)) fileDropZone.classList.remove('is-dragging');
  }));
  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileDropZone.classList.remove('is-dragging');
    if (modalType === 'Link') return;
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      f.file.files = transfer.files;
      updateFileSelection();
    } catch (error) {
      showErr('f-file-err', f.file, 'This browser could not accept the dropped file. Please use “browse files” instead.');
    }
  });
  fileDropZone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === fileDropZone) {
      e.preventDefault();
      f.file.click();
    }
  });

  function openModal(trigger) {
    opener = trigger || document.activeElement;
    form.reset();
    modalType = ''; sourceMode = ''; submitting = false;
    $$('#typePicker input').forEach((i) => { i.checked = false; });
    resourceDetails.hidden = true;
    linkSourceField.hidden = true;
    fileSourceField.hidden = true;
    fileDropZone.classList.remove('has-file', 'is-dragging');
    fileSelection.textContent = 'No file selected';
    fileError.hidden = true;
    $('#methodLinkBtn').setAttribute('aria-pressed', 'false');
    $('#methodFileBtn').setAttribute('aria-pressed', 'false');
    $('#methodFileBtn').disabled = false;
    showErr('f-title-err', f.title, ''); showErr('f-url-err', f.url, '');
    $('#formError').hidden = true;
    setSubmitting(false);
    $('#subjectList').innerHTML = subjectsList().map(([s]) => '<option value="' + esc(s) + '"></option>').join('');
    modal.classList.remove('closing'); dialog.classList.remove('closing');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const firstType = $('#typePicker input');
    if (firstType) firstType.focus();
  }
  function closeModal() {
    if (modal.hidden) return;
    const done = () => {
      modal.hidden = true;
      modal.classList.remove('closing'); dialog.classList.remove('closing');
      document.body.style.overflow = '';
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    };
    if (reduceMotion()) return done();
    modal.classList.add('closing'); dialog.classList.add('closing');
    setTimeout(done, 190);
  }
  function setSubmitting(on) {
    submitting = on;
    const b = $('#submitBtn');
    b.disabled = on;
    b.innerHTML = (on ? icon('loader', 16, 'spin') : '') + (on ? 'Adding…' : 'Add resource');
  }

  $('#addBtn').addEventListener('click', (e) => openModal(e.currentTarget));
  $('#accountBtn').addEventListener('click', async () => {
    if (OA.Auth && OA.Auth.isConfigured()) {
      try {
        const session = await OA.Auth.getSession();
        if (session) {
          await OA.Auth.signOut();
          window.location.href = 'login.html';
          return;
        }
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Could not sign out. Please try again.', 'error');
        return;
      }
    }
    window.location.href = 'login.html';
  });
  $('#modalClose').addEventListener('click', closeModal);
  $('#cancelBtn').addEventListener('click', closeModal);
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    const hasCheckedType = Boolean($('#typePicker input:checked'));
    const focusable = $$('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href]', dialog).filter((el) => el.offsetParent !== null && (el.type !== 'radio' || el.checked || !hasCheckedType));
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  f.title.addEventListener('input', () => showErr('f-title-err', f.title, ''));
  f.url.addEventListener('input', () => showErr('f-url-err', f.url, ''));

  function validate(title, url, file) {
    const errors = {};
    if (!modalType) errors.type = 'Choose a resource type first.';
    if (!title.trim()) errors.title = 'Give it a title so you can find it later.';
    if (sourceMode === 'link') {
      const u = url.trim();
      if (!u) errors.url = 'Paste a link to this resource.';
      else {
        try { if (!/^https?:$/.test(new URL(u).protocol)) throw new Error(); }
        catch (e) { errors.url = 'Enter a full link that starts with http:// or https://'; }
      }
    } else if (sourceMode === 'file') {
      if (!file) errors.file = 'Choose a file or drag one into the upload area.';
      else {
        const inferred = fileTypeFromName(file.name);
        if (!inferred) errors.file = 'This file type is not supported. Choose an image, PDF, Word document, or PPT file.';
        else if (inferred !== modalType) errors.file = 'The selected file does not match the resource type. Choose ' + TYPE_LABEL[modalType] + ' or change the type above.';
      }
    } else errors.type = 'Choose how you want to add this resource.';
    return errors;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!modalType) {
      const firstType = $('#typePicker input');
      toast('Choose a resource type first.');
      if (firstType) firstType.focus();
      return;
    }
    const file = sourceMode === 'file' ? ((f.file.files && f.file.files[0]) || undefined) : undefined;
    const url = sourceMode === 'link' ? f.url.value : '';
    const errs = validate(f.title.value, url, file);
    showErr('f-title-err', f.title, errs.title);
    showErr('f-url-err', f.url, errs.url);
    showErr('f-file-err', f.file, errs.file);
    if (errs.title) { shake(f.title); return f.title.focus(); }
    if (errs.url) { shake(f.url); return f.url.focus(); }
    if (errs.file) { fileDropZone.classList.add('has-error'); return; }
    fileDropZone.classList.remove('has-error');

    setSubmitting(true);
    $('#formError').hidden = true;
    try {
      await addResource({
        title: f.title.value.trim(),
        url: url.trim(),
        file: file,
        type: modalType,
        subject: f.subject.value.trim() || 'General',
        topic: f.topic.value.trim(),
        description: f.desc.value.trim(),
        tags: Array.from(new Set(f.tags.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))),
      });
    } catch (err) {
      const box = $('#formError');
      box.textContent = err instanceof Error ? err.message : 'We could not save this resource. Check the backend connection and try again.';
      box.hidden = false;
      setSubmitting(false);
    }
  });
  function shake(el) {
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  /* ============================================================
     Boot
     ============================================================ */
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'grid' || v === 'list') state.view = v;
    if (localStorage.getItem(RAIL_KEY) === 'closed') state.railOpen = false;
  } catch (e) {}
  // Keep the header action in sync with the Supabase session.
  if (OA.Auth && OA.Auth.isConfigured()) {
    OA.Auth.getSession().then((session) => {
      const accountBtn = $('#accountBtn');
      if (accountBtn) accountBtn.textContent = session ? 'Sign out' : 'Sign in';
    }).catch(() => {});
  }

  // If REQUIRE_AUTH is enabled, verify the session before loading the library.
  Promise.resolve(OA.Auth && OA.Auth.requireAppAccess ? OA.Auth.requireAppAccess() : true)
    .then(async (allowed) => {
      if (!allowed) return;
      if (OA.Auth && OA.Auth.isConfigured()) {
        const user = await OA.Auth.getUser();
        OA.currentUserId = user && user.id ? user.id : 'unknown-user';
      } else {
        OA.currentUserId = 'guest';
      }
      load();
    })
    .catch((error) => {
      console.error('Open Attic startup failed:', error);
      if (OA.Auth && OA.Auth.isRequired && OA.Auth.isRequired()) window.location.replace('login.html?error=session');
      else load();
    });
})();
