(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const auth = window.OA && window.OA.Auth;
  const form = $('#authForm');
  const email = $('#email');
  const password = $('#password');
  const confirmPassword = $('#confirmPassword');
  const submitBtn = $('#submitBtn');
  const message = $('#authMessage');
  const setupNotice = $('#setupNotice');
  const demoLink = $('#demoLink');
  let mode = new URLSearchParams(window.location.search).get('mode') === 'recovery' || window.location.hash.includes('type=recovery') ? 'recovery' : 'login';
  let busy = false;

  function setMessage(text, kind) {
    message.textContent = text;
    message.dataset.kind = kind || 'info';
    message.hidden = !text;
  }

  function setBusy(value) {
    busy = value;
    submitBtn.disabled = value;
    submitBtn.innerHTML = value ? '<span class="auth-spinner" aria-hidden="true">◌</span> Please wait…' : buttonText();
  }

  function buttonText() {
    if (mode === 'signup') return 'Create account <span aria-hidden="true">→</span>';
    if (mode === 'reset') return 'Send reset link <span aria-hidden="true">→</span>';
    if (mode === 'recovery') return 'Save new password <span aria-hidden="true">→</span>';
    return 'Sign in <span aria-hidden="true">→</span>';
  }

  function renderMode(clearMessage) {
    const signup = mode === 'signup';
    const reset = mode === 'reset';
    const recovery = mode === 'recovery';
    $('#authKicker').textContent = signup ? 'MAKE YOURSELF AT HOME' : reset ? 'ACCOUNT RECOVERY' : recovery ? 'ONE LAST STEP' : 'WELCOME BACK';
    $('#authTitle').textContent = signup ? 'Make space to learn.' : reset ? 'Let’s get you back in.' : recovery ? 'Choose a new password.' : 'Good to see you.';
    $('#authSubtitle').textContent = signup
      ? 'Create your account and start gathering your learning resources.'
      : reset ? 'We’ll email you a secure link to reset your password.'
      : recovery ? 'Choose a strong password for your Open Attic account.'
      : 'Sign in to find your place and pick up where you left off.';
    $('#nameField').hidden = !signup;
    $('#passwordField').hidden = reset;
    $('#confirmPasswordField').hidden = !(signup || recovery);
    $('#passwordLabel').textContent = recovery ? 'New password' : 'Password';
    password.autocomplete = recovery || signup ? 'new-password' : 'current-password';
    password.placeholder = recovery ? 'Choose at least 8 characters' : 'Enter your password';
    $('#passwordHint').hidden = !(signup || recovery);
    $('#forgotLink').hidden = signup || reset || recovery;
    $('#authSwitch').hidden = reset || recovery;
    $('#resetSwitch').hidden = mode === 'login' || mode === 'signup';
    $('#switchMode').textContent = signup ? 'Sign in instead' : 'Create an account';
    $('#switchMode').setAttribute('aria-label', signup ? 'Switch to sign in' : 'Switch to create account');
    submitBtn.innerHTML = buttonText();
    password.required = !reset;
    confirmPassword.required = signup || recovery;
    $('#fullName').required = false;
    if (clearMessage) setMessage('', 'info');
    document.title = (signup ? 'Create account' : reset ? 'Reset password' : recovery ? 'Choose a new password' : 'Sign in') + ' — Open Attic';
  }

  function friendlyError(error) {
    const raw = String((error && error.message) || 'Something went wrong. Please try again.');
    if (/invalid login credentials/i.test(raw)) return 'That email and password do not match. Check them and try again.';
    if (/email not confirmed/i.test(raw)) return 'Please confirm your email address using the link we sent you.';
    if (/user already registered/i.test(raw)) return 'An account already exists for this email. Try signing in instead.';
    if (/password should be at least/i.test(raw)) return 'Choose a password with at least 8 characters.';
    return raw;
  }

  $('#switchMode').addEventListener('click', () => {
    mode = mode === 'signup' ? 'login' : 'signup';
    renderMode(true);
    email.focus();
  });
  $('#forgotLink').addEventListener('click', (event) => {
    event.preventDefault();
    mode = 'reset';
    renderMode(true);
    email.focus();
  });
  $('#backToLogin').addEventListener('click', () => {
    mode = 'login';
    renderMode(true);
    email.focus();
  });
  $('#passwordToggle').addEventListener('click', () => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    $('#passwordToggle').textContent = visible ? 'Show' : 'Hide';
    $('#passwordToggle').setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
  });

  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('open-attic:theme', next); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === 'dark' ? '#1f1712' : '#EAE2D6';
    $('#themeBtn').innerHTML = next === 'dark'
      ? '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13A8.8 8.8 0 0 1 11 3.1 8.9 8.9 0 1 0 20.9 13Z"/></svg>';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (new URLSearchParams(window.location.search).get('setup') === 'api') {
      setMessage('Connect the Flask backend in your frontend .env before signing in to a personal library.', 'error');
      return;
    }
    const emailValue = email.value.trim();
    const passwordValue = password.value;
    if (!emailValue) { setMessage('Enter your email address to continue.', 'error'); email.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(emailValue)) { setMessage('Enter a valid email address.', 'error'); email.focus(); return; }
    if (mode !== 'reset' && passwordValue.length < 8) { setMessage('Use a password with at least 8 characters.', 'error'); password.focus(); return; }
    if ((mode === 'signup' || mode === 'recovery') && passwordValue !== confirmPassword.value) { setMessage('Those passwords do not match yet.', 'error'); confirmPassword.focus(); return; }
    if (!auth || !auth.isConfigured()) {
      setMessage('Supabase Auth is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env, then restart the frontend. You can still explore the demo library below.', 'error');
      setupNotice.hidden = false;
      return;
    }

    setBusy(true);
    setMessage('', 'info');
    try {
      if (mode === 'login') {
        await auth.signIn(emailValue, passwordValue);
        window.location.replace('index.html');
        return;
      }
      if (mode === 'signup') {
        const data = await auth.signUp(emailValue, passwordValue, $("#fullName").value);
        if (data.session) {
          window.location.replace('index.html');
          return;
        }
        setMessage('Your account has been created. Check your inbox for the email confirmation link, then sign in.', 'success');
        mode = 'login';
        renderMode(false);
        return;
      }
      if (mode === 'reset') {
        await auth.sendPasswordReset(emailValue);
        setMessage('If an account exists for that email, a password reset link is on its way.', 'success');
        return;
      }
      if (mode === 'recovery') {
        await auth.updatePassword(passwordValue);
        setMessage('Password updated. Taking you back to your learning space…', 'success');
        setTimeout(() => window.location.replace('index.html'), 850);
      }
    } catch (error) {
      setMessage(friendlyError(error), 'error');
    } finally {
      setBusy(false);
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('setup') === 'api') {
    setupNotice.hidden = false;
    setupNotice.querySelector('strong').textContent = 'Connect your Open Attic backend';
    setupNotice.querySelector('p').textContent = 'Set VITE_API_BASE_URL to your Flask API (including /api) in .env, then restart the frontend. Per-user libraries require the backend.';
    demoLink.hidden = true;
  } else if (!auth || !auth.isConfigured()) {
    setupNotice.hidden = false;
    if (auth && auth.isRequired()) {
      setupNotice.querySelector('strong').textContent = 'Authentication setup required';
      setupNotice.querySelector('p').textContent = 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env and configure Supabase Email Auth before continuing.';
      demoLink.hidden = true;
    }
  } else {
    setupNotice.hidden = true;
    auth.getSession().then((session) => {
      if (session && (mode === 'login' || mode === 'signup')) window.location.replace('index.html');
    }).catch(() => {});
  }

  if (params.get('error') === 'session') {
    setMessage('We could not verify your session. Please sign in again.', 'error');
  }
  renderMode(false);
})();
