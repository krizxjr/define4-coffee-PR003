(function () {
  'use strict';
  const OA = window.OA, api = OA.api;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const esc = OA.esc;
  let resources = [], collections = [], activeCollection = null, busy = false;
  const messageBox = $('#pageMessage');
  function message(text, tone) { messageBox.textContent = text; messageBox.dataset.tone = tone || ''; messageBox.hidden = !text; }
  function toast(text, error) { const n = document.createElement('p'); n.className = 'toast toast-' + (error ? 'error' : 'ok'); n.textContent = text; $('#toasts').appendChild(n); setTimeout(() => n.remove(), 3800); }
  function paintThemeButton() { const dark = document.documentElement.dataset.theme === 'dark'; $('#themeBtn').innerHTML = OA.icon(dark ? 'sun' : 'moon', 20); $('#themeBtn').title = dark ? 'Switch to light theme' : 'Switch to dark theme'; }
  $('#themeBtn').addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('open-attic:theme', document.documentElement.dataset.theme); paintThemeButton(); });
  paintThemeButton();
  $('#accountBtn').addEventListener('click', async () => { try { if (OA.Auth) await OA.Auth.signOut(); } catch (e) { message(e.message || 'Could not sign out.', 'error'); return; } window.location.href = 'login.html'; });

  function collectionCard(c) {
    const count = Number(c.item_count || (c.items || []).length || 0), done = Number(c.completed_count || (c.items || []).filter((r) => r.completed).length || 0), pct = count ? Math.round(done / count * 100) : 0;
    return '<article class="social-card" data-collection="' + esc(c.id) + '"><h3>' + esc(c.name) + '</h3><p>' + esc(c.description || 'A focused trail through your learning resources.') + '</p><div class="social-card-meta"><span class="social-pill">' + count + ' resource' + (count === 1 ? '' : 's') + '</span><span class="social-pill">' + done + ' complete</span></div><div class="collection-progress"><span style="width:' + pct + '%"></span></div><div class="social-card-actions"><button class="btn btn-solid btn-sm" data-action="open" data-id="' + esc(c.id) + '">Open collection <span aria-hidden="true">→</span></button><button class="btn btn-outline btn-sm" data-action="delete-collection" data-id="' + esc(c.id) + '">Delete</button></div></article>';
  }
  async function loadAll() {
    $('#collectionList').innerHTML = '<div class="social-empty">Loading collections…</div>';
    try {
      [collections, resources] = await Promise.all([api.listCollections(), api.list()]);
      $('#collectionList').innerHTML = collections.length ? collections.map(collectionCard).join('') : '<div class="social-empty"><h3>No collections yet</h3><p>Create one to build a focused path through your saved learning resources.</p></div>';
      if (activeCollection) { const exists = collections.find((c) => String(c.id) === String(activeCollection)); if (exists) await openCollection(activeCollection); else { activeCollection = null; $('#collectionDetail').hidden = true; } }
    } catch (error) { $('#collectionList').innerHTML = '<div class="social-empty"><h3>Could not load your collections</h3><p>' + esc(error.message || 'Check the backend connection and your sign-in session.') + '</p><button class="btn btn-outline" type="button" id="retryCollections">Try again</button></div>'; }
  }
  async function openCollection(id) {
    activeCollection = id; $('#collectionDetail').hidden = false; $('#collectionItems').innerHTML = '<div class="social-empty">Loading this collection…</div>';
    try {
      const collection = await api.getCollection(id);
      if (!collection) throw new Error('Collection not found.');
      $('#detailTitle').textContent = collection.name; $('#detailDescription').textContent = collection.description || 'A focused trail through your learning resources.';
      const items = collection.items || [], done = items.filter((r) => r.completed).length, pct = items.length ? Math.round(done/items.length*100) : 0;
      $('#detailProgress').style.width = pct + '%'; $('#detailProgressText').textContent = done + ' of ' + items.length + ' completed · progress is tracked only inside this collection.';
      const already = new Set(items.map((r) => String(r.resource_id || r.id)));
      const options = resources.filter((r) => !already.has(String(r.id)));
      $('#resourceSelect').innerHTML = '<option value="">Choose a resource…</option>' + options.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.title) + ' · ' + esc(r.type) + '</option>').join('');
      $('#addToCollectionBtn').disabled = options.length === 0;
      if (!options.length) $('#resourceSelect').innerHTML = '<option value="">All library resources are already included</option>';
      $('#collectionItems').innerHTML = items.length ? items.map(item => {
        const title = item.title || 'Untitled resource';
        const itemId = item.item_id || item.id;
        const opened = item.isFile ? '<button class="btn btn-outline btn-sm" data-action="open-resource" data-resource="' + esc(item.resource_id || item.id) + '">Open</button>' : '<a class="btn btn-outline btn-sm" href="' + esc(OA.safeHref(item.url)) + '" target="_blank" rel="noopener noreferrer">Open</a>';
        return '<article class="collection-item' + (item.completed ? ' is-complete' : '') + '" data-item="' + esc(itemId) + '"><div class="collection-item-main"><strong>' + esc(title) + '</strong><p>' + esc(item.subject_name || item.subject || 'General') + (item.topic_name || item.topic ? ' · ' + esc(item.topic_name || item.topic) : '') + ' · ' + esc(item.type || item.resource_type || 'Link') + '</p></div><div class="collection-item-actions">' + opened + '<button class="btn btn-sm ' + (item.completed ? 'btn-outline' : 'btn-solid') + '" data-action="toggle-complete" data-id="' + esc(itemId) + '" aria-pressed="' + Boolean(item.completed) + '">' + (item.completed ? 'Completed ✓' : 'Mark complete') + '</button><button class="btn btn-ghost btn-sm" data-action="remove-item" data-id="' + esc(itemId) + '">Remove</button></div></article>';
      }).join('') : '<div class="social-empty"><h3>Your collection is ready</h3><p>Add resources from your library above. This is where completion actions live.</p></div>';
      $('#collectionDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { message(error.message || 'Could not open this collection.', 'error'); }
  }
  $('#createCollectionForm').addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy) return; busy = true; const btn = $('#createCollectionBtn'); btn.disabled = true;
    try { const row = await api.createCollection({ name: $('#collectionName').value.trim(), description: $('#collectionDescription').value.trim() }); $('#createCollectionForm').reset(); message('Collection created. Add resources to build your learning trail.', 'success'); await loadAll(); await openCollection(row.id); }
    catch (error) { message(error.message || 'Could not create the collection.', 'error'); }
    finally { busy = false; btn.disabled = false; }
  });
  $('#collectionList').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]'); if (!btn || busy) { if (event.target.id === 'retryCollections') loadAll(); return; }
    busy = true; btn.disabled = true; const action = btn.dataset.action, id = btn.dataset.id;
    try { if (action === 'open') await openCollection(id); else if (action === 'delete-collection') { if (!confirm('Delete this collection? The resources in your library will not be deleted.')) return; await api.deleteCollection(id); if (String(activeCollection) === String(id)) { activeCollection = null; $('#collectionDetail').hidden = true; } toast('Collection deleted.'); await loadAll(); } }
    catch (error) { message(error.message || 'That collection action failed.', 'error'); }
    finally { busy = false; btn.disabled = false; }
  });
  $('#addCollectionItemForm').addEventListener('submit', async (event) => {
    event.preventDefault(); if (!activeCollection || busy || !$('#resourceSelect').value) return; busy = true; $('#addToCollectionBtn').disabled = true;
    try { await api.addCollectionItem(activeCollection, $('#resourceSelect').value); toast('Resource added to collection.'); await loadAll(); }
    catch (error) { message(error.message || 'Could not add this resource.', 'error'); }
    finally { busy = false; $('#addToCollectionBtn').disabled = false; }
  });
  $('#collectionItems').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]'); if (!btn || busy) return; const action = btn.dataset.action, id = btn.dataset.id || btn.dataset.resource; busy = true; btn.disabled = true;
    try {
      if (action === 'toggle-complete') { const card = btn.closest('[data-item]'); const next = btn.getAttribute('aria-pressed') !== 'true'; await api.updateCollectionItem(activeCollection, id, next); toast(next ? 'Marked complete in this collection.' : 'Moved back to in progress.'); await loadAll(); }
      else if (action === 'remove-item') { await api.removeCollectionItem(activeCollection, id); toast('Removed from collection.'); await loadAll(); }
      else if (action === 'open-resource') { const resource = resources.find((r) => String(r.id) === String(id)); if (!resource) throw new Error('Resource not found in your library.'); if (resource.isFile) { const w = window.open('about:blank', '_blank'); if (w) w.location.href = await api.fileUrl(resource.id); } else window.open(OA.safeHref(resource.url), '_blank', 'noopener,noreferrer'); }
    } catch (error) { message(error.message || 'That collection action failed.', 'error'); }
    finally { busy = false; btn.disabled = false; }
  });
  $('#closeCollection').addEventListener('click', () => { activeCollection = null; $('#collectionDetail').hidden = true; });
  Promise.resolve(OA.Auth && OA.Auth.requireAppAccess ? OA.Auth.requireAppAccess() : true).then(async (allowed) => { if (!allowed) return; if (OA.Auth && OA.Auth.isConfigured()) { const user = await OA.Auth.getUser(); OA.currentUserId = user && user.id || 'unknown-user'; } else OA.currentUserId = 'guest'; await loadAll(); }).catch((e) => { message(e.message || 'Could not verify your session.', 'error'); });
})();
