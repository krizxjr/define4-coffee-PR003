/* API adapter. Demo mode (no API_BASE_URL) keeps everything in localStorage.
   With API_BASE_URL set it talks to the Flask backend:
     GET /resources, POST /resources, PATCH /resources/:id, DELETE /resources/:id,
     POST /uploads/file, GET /resources/:id/file-url, /subjects, /topics */
(function () {
  const OA = (window.OA = window.OA || {});
  const BASE = String((window.OPEN_ATTIC_CONFIG && window.OPEN_ATTIC_CONFIG.API_BASE_URL) || '').trim().replace(/\/+$/, '');
  const isDemo = BASE === '';
  const STORE_KEY_PREFIX = 'open-attic:resources:v1:';
  const META_KEY_PREFIX = 'open-attic:resource-meta:v1:';
  function currentUserKey() {
    try {
      return String(OA.currentUserId || localStorage.getItem('open-attic:active-user-id') || 'guest');
    } catch (e) {
      return String(OA.currentUserId || 'guest');
    }
  }
  function storeKey() { return STORE_KEY_PREFIX + currentUserKey(); }
  function metaKey() { return META_KEY_PREFIX + currentUserKey(); }

  function collectionStoreKey() { return 'open-attic:collections:v1:' + currentUserKey(); }
  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  const TYPE_TO_BACKEND = { Image: 'image', PDF: 'pdf', Word: 'document', PPT: 'presentation', Link: 'link' };
  const isPdf = (mime, name) => mime.indexOf('pdf') !== -1 || /\.pdf(?:[?#].*)?$/i.test(String(name || ''));
  const fileCategory = (mime, name) => {
    const n = String(name || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|avif)(?:[?#].*)?$/.test(n)) return 'Image';
    if (isPdf(mime, n)) return 'PDF';
    if (/word|msword|officedocument\.wordprocessingml/.test(mime) || /\.(doc|docx)(?:[?#].*)?$/.test(n)) return 'Word';
    if (/powerpoint|presentationml/.test(mime) || /\.(ppt|pptx)(?:[?#].*)?$/.test(n)) return 'PPT';
    return 'Link';
  };
  function backendTypeFor(type, url) {
    if (type === 'Link' && /github\.com/i.test(String(url || ''))) return 'repository';
    return TYPE_TO_BACKEND[type] || 'link';
  }

  async function request(path, init) {
    init = init || {};
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    // Forward the Supabase access token when a session exists. The Flask API must
    // independently verify this JWT before protecting any data or write operation.
    if (OA.Auth && OA.Auth.isConfigured()) {
      try {
        const token = await OA.Auth.getAccessToken();
        if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
      } catch (e) { /* Public/demo endpoints can still report their own auth errors. */ }
    }
    let res;
    try {
      res = await fetch(BASE + path, Object.assign({}, init, { headers: headers }));
    } catch (e) {
      throw new Error('Cannot reach the Open Attic API at ' + BASE + '. Check that the Flask backend is running and the URL is correct.');
    }
    const text = await res.text();
    let payload;
    try { payload = text ? JSON.parse(text) : undefined; } catch (e) { payload = text; }
    if (!res.ok) {
      const message = (payload && (payload.error || payload.message)) || 'Request failed (' + res.status + ')';
      if (res.status === 401 && window.OPEN_ATTIC_CONFIG && window.OPEN_ATTIC_CONFIG.REQUIRE_AUTH) {
        if (!window.location.pathname.endsWith('/login.html')) window.location.replace('login.html?error=session');
      }
      throw new Error(message);
    }
    return payload;
  }

  function readMeta() { try { return JSON.parse(localStorage.getItem(metaKey()) || '{}'); } catch (e) { return {}; } }
  function writeMeta(m) { try { localStorage.setItem(metaKey(), JSON.stringify(m)); } catch (e) {} }

  function normalize(raw, meta) {
    meta = meta || readMeta();
    const id = String(raw.id != null ? raw.id : raw._id);
    const extra = meta[id] || {};
    const rawType = String(raw.resource_type || raw.type || '').toLowerCase();
    const fileName = String(raw.original_filename || raw.file_name || raw.filename || raw.name || '');
    const mime = String(raw.mime_type || raw.content_type || '').toLowerCase();
    const filePath = raw.file_path || raw.storage_path || raw.file_key || raw.storage_key || raw.object_path;
    const rawUrl = String(raw.url || raw.external_url || '');
    const isFile = Boolean(raw.is_file || raw.file_url || filePath || fileName || mime) ||
      (!/^https?:\/\//i.test(rawUrl) && Boolean(rawUrl.trim()));

    let type = 'Link';
    if (isFile || fileName || mime) type = fileCategory(mime, fileName);
    else if (rawType === 'image') type = 'Image';
    else if (rawType === 'pdf') type = 'PDF';
    else if (rawType === 'document') type = 'Word';
    else if (rawType === 'presentation') type = 'PPT';
    else type = fileCategory('', rawUrl);

    return Object.assign({
      id: id,
      title: String(raw.title || ''),
      description: String(raw.description || ''),
      type: type,
      subject: String(raw.subject_name || raw.subject || 'General'),
      topic: String(raw.topic_name || raw.topic || ''),
      url: rawUrl,
      isFile: isFile,
      tags: Array.isArray(raw.tags) ? raw.tags.map((t) => (typeof t === 'string' ? t : String((t && t.name) || t))) : [],
      createdAt: String(raw.created_at || raw.createdAt || new Date().toISOString()),
      bookmarked: Boolean(extra.bookmarked != null ? extra.bookmarked : raw.bookmarked),
      completed: Boolean(extra.completed != null ? extra.completed : raw.completed),
      lastAccessed: extra.lastAccessed || raw.last_accessed || undefined,
    }, extra);
  }

  /* ---------- Demo storage (seeded on first visit) ---------- */
  function readDemo() {
    try {
      const raw = localStorage.getItem(storeKey());
      if (raw === null) { const seed = OA.buildSeed(); writeDemo(seed); return seed; }
      return JSON.parse(raw);
    } catch (e) { return []; }
  }
  function writeDemo(items) { try { localStorage.setItem(storeKey(), JSON.stringify(items)); } catch (e) {} }

  async function getSubjectAndTopic(subjectName, topicName) {
    const wantedSubject = subjectName.trim() || 'General';
    const wantedTopic = topicName.trim() || 'General';
    const find = (rows, n) => rows.find((x) => x.name.toLowerCase() === n.toLowerCase());
    let subjects = await request('/subjects');
    let subject = find(subjects, wantedSubject);
    if (!subject) {
      try { subject = await request('/subjects', { method: 'POST', body: JSON.stringify({ name: wantedSubject }) }); }
      catch (e) { subjects = await request('/subjects'); subject = find(subjects, wantedSubject); if (!subject) throw e; }
    }
    let topics = await request('/topics?subject_id=' + subject.id);
    let topic = find(topics, wantedTopic);
    if (!topic) {
      try { topic = await request('/topics', { method: 'POST', body: JSON.stringify({ subject_id: subject.id, name: wantedTopic }) }); }
      catch (e) { topics = await request('/topics?subject_id=' + subject.id); topic = find(topics, wantedTopic); if (!topic) throw e; }
    }
    return topic.id;
  }

  const api = {
    async list() {
      if (isDemo) {
        const allowed = ['Image', 'PDF', 'Word', 'PPT', 'Link'];
        const rows = readDemo().map((r) => Object.assign({}, r, { type: allowed.includes(r.type) ? r.type : (r.type === 'PDF' ? 'PDF' : 'Link') }));
        writeDemo(rows);
        return rows;
      }
      const payload = await request('/resources?per_page=100&sort=newest');
      const rows = Array.isArray(payload) ? payload : payload.items || payload.resources || [];
      const meta = readMeta();
      return rows.map((r) => normalize(r, meta));
    },
    async create(input) {
      if (input.file) return api.uploadFile(input.file, input);
      if (isDemo) {
        const item = Object.assign({}, input, { id: OA.uid(), createdAt: new Date().toISOString(), bookmarked: false, completed: false });
        delete item.file;
        writeDemo([item].concat(readDemo()));
        return item;
      }
      const topic_id = await getSubjectAndTopic(input.subject, input.topic);
      const raw = await request('/resources', {
        method: 'POST',
        body: JSON.stringify({ topic_id: topic_id, title: input.title, description: input.description, resource_type: backendTypeFor(input.type, input.url), url: input.url, tags: input.tags }),
      });
      return normalize(raw.resource || raw.item || raw);
    },
    async update(id, patch) {
      if (isDemo) {
        let updated;
        writeDemo(readDemo().map((r) => (r.id !== id ? r : (updated = Object.assign({}, r, patch)))));
        return updated;
      }
      // The backend has no bookmark/progress/last-opened columns, so keep those locally.
      const localKeys = ['bookmarked', 'lastAccessed'];
      const localPatch = {}, serverPatch = {};
      Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (localKeys.indexOf(key) !== -1) localPatch[key] = value;
        else if (['title', 'description', 'url', 'tags'].indexOf(key) !== -1) serverPatch[key] = value;
        else if (key === 'type') serverPatch.resource_type = TYPE_TO_BACKEND[value];
      });
      if (Object.keys(localPatch).length) {
        const meta = readMeta(); meta[id] = Object.assign({}, meta[id], localPatch); writeMeta(meta);
      }
      if (Object.keys(serverPatch).length) {
        const raw = await request('/resources/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(serverPatch) });
        return normalize(raw);
      }
      return undefined;
    },
    async remove(id) {
      if (isDemo) { writeDemo(readDemo().filter((r) => r.id !== id)); return; }
      await request('/resources/' + encodeURIComponent(id), { method: 'DELETE' });
      const meta = readMeta(); delete meta[id]; writeMeta(meta);
    },
    async uploadFile(file, d) {
      if (isDemo) throw new Error('File uploads require the Flask backend. Set VITE_API_BASE_URL in .env and restart the frontend first.');
      const topic_id = await getSubjectAndTopic(d.subject, d.topic);
      const name = file.name.toLowerCase();
      let uploadType = d.type;
      if (name.endsWith('.pdf')) uploadType = 'PDF';
      else if (/\.(png|jpe?g|gif|webp|svg|bmp|tiff?|avif)$/i.test(name)) uploadType = 'Image';
      else if (/\.(doc|docx)$/i.test(name)) uploadType = 'Word';
      else if (/\.(ppt|pptx)$/i.test(name)) uploadType = 'PPT';
      else throw new Error('Only Images, PDFs, Word documents, and PPT files can be uploaded. Add Git repositories and web links using a URL.');
      const body = new FormData();
      body.append('file', file); body.append('topic_id', String(topic_id)); body.append('title', d.title);
      body.append('description', d.description); body.append('resource_type', TYPE_TO_BACKEND[uploadType]);
      body.append('tags', d.tags.join(','));
      const response = await request('/uploads/file', { method: 'POST', body: body });
      return normalize(response.resource || response.item || response);
    },
    async fileUrl(id) {
      const result = await request('/resources/' + encodeURIComponent(id) + '/file-url');
      return result.url;
    },
    async listCollections() {
      if (isDemo) return readJson(collectionStoreKey(), []);
      const payload = await request('/collections');
      return payload.items || [];
    },
    async createCollection(input) {
      if (isDemo) {
        const collection = { id: OA.uid(), name: input.name, description: input.description || '', created_at: new Date().toISOString(), items: [], item_count: 0, completed_count: 0 };
        const rows = readJson(collectionStoreKey(), []); rows.unshift(collection); writeJson(collectionStoreKey(), rows); return collection;
      }
      return request('/collections', { method: 'POST', body: JSON.stringify(input) });
    },
    async getCollection(id) {
      if (isDemo) return readJson(collectionStoreKey(), []).find((c) => String(c.id) === String(id)) || null;
      const collection = await request('/collections/' + encodeURIComponent(id));
      collection.items = (collection.items || []).map((row) => Object.assign(normalize(row), { item_id: row.item_id, resource_id: row.resource_id, completed: Boolean(row.completed), completed_at: row.completed_at || null }));
      return collection;
    },
    async deleteCollection(id) {
      if (isDemo) { writeJson(collectionStoreKey(), readJson(collectionStoreKey(), []).filter((c) => String(c.id) !== String(id))); return; }
      await request('/collections/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    async addCollectionItem(collectionId, resourceId) {
      if (isDemo) {
        const rows = readJson(collectionStoreKey(), []); const collection = rows.find((c) => String(c.id) === String(collectionId));
        if (!collection) throw new Error('Collection not found.');
        const resources = await api.list(); const resource = resources.find((r) => String(r.id) === String(resourceId));
        if (!resource) throw new Error('Resource not found.');
        if ((collection.items || []).some((r) => String(r.resource_id) === String(resourceId))) throw new Error('This resource is already in the collection.');
        collection.items = collection.items || []; collection.items.push(Object.assign({}, resource, { item_id: OA.uid(), resource_id: resource.id, completed: false }));
        collection.item_count = collection.items.length; writeJson(collectionStoreKey(), rows); return collection.items[collection.items.length - 1];
      }
      return request('/collections/' + encodeURIComponent(collectionId) + '/items', { method: 'POST', body: JSON.stringify({ resource_id: Number(resourceId) }) });
    },
    async updateCollectionItem(collectionId, itemId, completed) {
      if (isDemo) {
        const rows = readJson(collectionStoreKey(), []); const collection = rows.find((c) => String(c.id) === String(collectionId));
        const item = collection && (collection.items || []).find((r) => String(r.item_id) === String(itemId));
        if (!item) throw new Error('Collection item not found.');
        item.completed = Boolean(completed); item.completed_at = completed ? new Date().toISOString() : null;
        collection.completed_count = collection.items.filter((r) => r.completed).length; writeJson(collectionStoreKey(), rows); return item;
      }
      return request('/collections/' + encodeURIComponent(collectionId) + '/items/' + encodeURIComponent(itemId), { method: 'PATCH', body: JSON.stringify({ completed: Boolean(completed) }) });
    },
    async removeCollectionItem(collectionId, itemId) {
      if (isDemo) {
        const rows = readJson(collectionStoreKey(), []); const collection = rows.find((c) => String(c.id) === String(collectionId));
        if (!collection) return;
        collection.items = (collection.items || []).filter((r) => String(r.item_id) !== String(itemId)); collection.item_count = collection.items.length;
        collection.completed_count = collection.items.filter((r) => r.completed).length; writeJson(collectionStoreKey(), rows); return;
      }
      await request('/collections/' + encodeURIComponent(collectionId) + '/items/' + encodeURIComponent(itemId), { method: 'DELETE' });
    },
    async listCommunities(search, scope) {
      const params = new URLSearchParams(); if (search) params.set('search', search); if (scope) params.set('scope', scope);
      const payload = await request('/communities' + (params.toString() ? '?' + params.toString() : ''));
      return payload.items || [];
    },
    async createCommunity(input) { return request('/communities', { method: 'POST', body: JSON.stringify(input) }); },
    async joinCommunity(id) { return request('/communities/' + encodeURIComponent(id) + '/join', { method: 'POST', body: JSON.stringify({}) }); },
    async leaveCommunity(id) { return request('/communities/' + encodeURIComponent(id) + '/join', { method: 'DELETE' }); },
    async communityMembers(id) { return request('/communities/' + encodeURIComponent(id) + '/members'); },
    resetDemo() {
      try { localStorage.removeItem(storeKey()); } catch (e) {}
    },
  };

  OA.api = api;
  OA.isDemo = isDemo;
})();
