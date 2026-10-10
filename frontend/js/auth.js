/* Supabase Auth adapter for the static HTML frontend. */
(function () {
  'use strict';
  const OA = (window.OA = window.OA || {});
  const config = () => window.OPEN_ATTIC_CONFIG || {};
  let client = null;

  function isConfigured() {
    const c = config();
    return Boolean(String(c.SUPABASE_URL || '').trim() && String(c.SUPABASE_ANON_KEY || c.SUPABASE_PUBLISHABLE_KEY || '').trim());
  }

  function isRequired() { return config().REQUIRE_AUTH === true; }

  function isApiConfigured() { return Boolean(String(config().API_BASE_URL || '').trim()); }

  function syncActiveUser(session) {
    try {
      if (session && session.user && session.user.id) {
        localStorage.setItem('open-attic:active-user-id', String(session.user.id));
      } else {
        localStorage.removeItem('open-attic:active-user-id');
      }
    } catch (e) { /* localStorage may be unavailable */ }
  }

  function getClient() {
    if (!isConfigured()) {
      throw new Error('Sign-in is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env, then restart the frontend.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('The Supabase Auth library did not load. Check your internet connection and reload the page.');
    }
    if (!client) {
      client = window.supabase.createClient(config().SUPABASE_URL.trim(), String(config().SUPABASE_PUBLISHABLE_KEY || config().SUPABASE_ANON_KEY).trim(), {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
    return client;
  }

  async function getSession() {
    if (!isConfigured()) { syncActiveUser(null); return null; }
    const result = await getClient().auth.getSession();
    if (result.error) throw result.error;
    const session = result.data.session || null;
    syncActiveUser(session);
    return session;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session && session.access_token ? session.access_token : null;
  }

  async function getUser() {
    const session = await getSession();
    return session && session.user ? session.user : null;
  }

  async function signIn(email, password) {
    const result = await getClient().auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) throw result.error;
    syncActiveUser(result.data.session || null);
    return result.data;
  }

  async function signUp(email, password, fullName) {
    const redirectTo = new URL('index.html', window.location.href).href;
    const result = await getClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: fullName && fullName.trim() ? { full_name: fullName.trim() } : {},
      },
    });
    if (result.error) throw result.error;
    syncActiveUser(result.data.session || null);
    return result.data;
  }

  async function sendPasswordReset(email) {
    const redirectTo = new URL('login.html?mode=recovery', window.location.href).href;
    const result = await getClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (result.error) throw result.error;
    return result.data;
  }

  async function updatePassword(password) {
    const result = await getClient().auth.updateUser({ password });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    if (!isConfigured()) return;
    const result = await getClient().auth.signOut();
    if (result.error) throw result.error;
    syncActiveUser(null);
  }

  async function requireAppAccess() {
    const root = document.documentElement;
    if (!isRequired()) {
      root.removeAttribute('data-auth-pending');
      return true;
    }
    if (!isConfigured()) {
      window.location.replace('login.html?setup=required');
      return false;
    }
    if (!isApiConfigured()) {
      window.location.replace('login.html?setup=api');
      return false;
    }
    try {
      const session = await getSession();
      if (!session) {
        window.location.replace('login.html');
        return false;
      }
      root.removeAttribute('data-auth-pending');
      return true;
    } catch (error) {
      console.error('Could not verify Open Attic session:', error);
      window.location.replace('login.html?error=session');
      return false;
    }
  }

  OA.Auth = {
    isConfigured,
    isRequired,
    isApiConfigured,
    getSession,
    getAccessToken,
    getUser,
    signIn,
    signUp,
    sendPasswordReset,
    updatePassword,
    signOut,
    requireAppAccess,
  };
})();
