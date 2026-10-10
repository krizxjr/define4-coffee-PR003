(function () {
  'use strict';
  const OA = window.OA, api = OA.api;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const esc = OA.esc;
  let scope = 'all', searchTimer = 0, busy = false;
  const messageBox = $('#pageMessage');
  function message(text, tone) { messageBox.textContent = text; messageBox.dataset.tone = tone || ''; messageBox.hidden = !text; }
  function toast(text, error) { const n = document.createElement('p'); n.className = 'toast toast-' + (error ? 'error' : 'ok'); n.textContent = text; $('#toasts').appendChild(n); setTimeout(() => n.remove(), 3800); }
  function paintThemeButton() { const dark = document.documentElement.dataset.theme === 'dark'; $('#themeBtn').innerHTML = OA.icon(dark ? 'sun' : 'moon', 20); $('#themeBtn').title = dark ? 'Switch to light theme' : 'Switch to dark theme'; }
  $('#themeBtn').addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('open-attic:theme', document.documentElement.dataset.theme); paintThemeButton(); });
  paintThemeButton();
  $('#accountBtn').addEventListener('click', async () => { try { if (OA.Auth) await OA.Auth.signOut(); } catch (e) { message(e.message || 'Could not sign out.', 'error'); return; } window.location.href = 'login.html'; });

  function communityCard(c) {
    const isMember = c.is_member;
    return '<article class="social-card" data-community="' + esc(c.id) + '">' +
      '<div class="social-card-meta"><span class="social-pill">' + (c.member_count || 0) + ' member' + ((c.member_count || 0) === 1 ? '' : 's') + '</span>' + (c.my_role === 'admin' ? '<span class="social-pill">You host this</span>' : '') + '</div>' +
      '<h3>' + esc(c.name) + '</h3><p>' + esc(c.description || 'A place to learn and share resources together.') + '</p>' +
      '<p class="social-muted" style="margin-top:10px">Started by ' + esc(c.creator_name || 'Open Attic member') + '</p>' +
      '<div class="social-card-actions">' + (isMember ? '<button class="btn btn-outline btn-sm" data-action="leave" data-id="' + esc(c.id) + '">Leave community</button>' : '<button class="btn btn-solid btn-sm" data-action="join" data-id="' + esc(c.id) + '">Join community</button>') +
      '<button class="btn btn-ghost btn-sm" data-action="members" data-id="' + esc(c.id) + '">View members</button></div><div class="community-members" data-members-for="' + esc(c.id) + '" hidden></div></article>';
  }
  async function loadCommunities() {
    const box = $('#communityList'); box.innerHTML = '<div class="social-empty">Loading communities…</div>';
    try {
      const rows = await api.listCommunities($('#communitySearch').value.trim(), scope);
      $('#communityListTitle').textContent = scope === 'mine' ? 'Communities you joined' : 'Discover communities';
      $('#communityListSub').textContent = rows.length ? rows.length + (rows.length === 1 ? ' community' : ' communities') + ' to explore.' : 'No communities match just yet.';
      box.innerHTML = rows.length ? rows.map(communityCard).join('') : '<div class="social-empty"><h3>' + (scope === 'mine' ? 'You have not joined a community yet' : 'No communities found') + '</h3><p>Try another search or create a community for your course or project.</p></div>';
    } catch (error) { box.innerHTML = '<div class="social-empty"><h3>We could not load communities</h3><p>' + esc(error.message || 'Check your Flask API connection and sign-in session.') + '</p><button type="button" class="btn btn-outline" id="retryCommunities">Try again</button></div>'; }
  }
  $('#communityList').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]'); if (!btn || busy) return;
    const action = btn.dataset.action, id = btn.dataset.id; busy = true; btn.disabled = true;
    try {
      if (action === 'join') { await api.joinCommunity(id); toast('You joined the community.'); await loadCommunities(); }
      else if (action === 'leave') { await api.leaveCommunity(id); toast('You left the community.'); await loadCommunities(); }
      else if (action === 'members') {
        const panel = $('[data-members-for="' + CSS.escape(id) + '"]');
        if (!panel.hidden) panel.hidden = true;
        else { const payload = await api.communityMembers(id); panel.innerHTML = '<strong>Members (' + payload.total + ')</strong><ul>' + payload.items.map((m) => '<li><span>' + esc(m.display_name) + '</span><span class="member-role">' + esc(m.role) + '</span></li>').join('') + '</ul>'; panel.hidden = false; }
      } else if (action === 'retry') loadCommunities();
    } catch (error) { message(error.message || 'That community action failed.', 'error'); }
    finally { busy = false; btn.disabled = false; }
  });
  $('#communityList').addEventListener('click', (e) => { if (e.target.id === 'retryCommunities') loadCommunities(); });
  $('#createCommunityForm').addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy) return; busy = true; const button = $('#createCommunityBtn'); button.disabled = true;
    try { await api.createCommunity({ name: $('#communityName').value.trim(), description: $('#communityDescription').value.trim() }); $('#createCommunityForm').reset(); message('Community created. You are its first member and host.', 'success'); scope = 'mine'; document.querySelectorAll('[data-scope]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scope === scope))); await loadCommunities(); }
    catch (error) { message(error.message || 'Could not create the community.', 'error'); }
    finally { busy = false; button.disabled = false; }
  });
  $('#communityScope').addEventListener('click', (e) => { const b = e.target.closest('[data-scope]'); if (!b) return; scope = b.dataset.scope; document.querySelectorAll('[data-scope]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); loadCommunities(); });
  $('#communitySearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadCommunities, 240); });
  Promise.resolve(OA.Auth && OA.Auth.requireAppAccess ? OA.Auth.requireAppAccess() : true).then(async (allowed) => { if (!allowed) return; if (OA.Auth && OA.Auth.isConfigured()) { const user = await OA.Auth.getUser(); OA.currentUserId = user && user.id || 'unknown-user'; } else OA.currentUserId = 'guest'; loadCommunities(); }).catch((e) => { message(e.message || 'Could not verify your session.', 'error'); });
})();
