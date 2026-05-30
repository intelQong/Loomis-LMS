// ============================================================
// Learning Portal — Auth Logic (Cloudflare Pages Functions + D1)
// ============================================================

function switchTab(event, tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelector(`#${tab}Form`).classList.add('active');
  event.target.classList.add('active');
}

function togglePw(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function openForgotPasswordModal(event) {
  if (event) event.preventDefault();
  const loginEmail = document.getElementById('loginEmail').value.trim();
  document.getElementById('forgotEmail').value = loginEmail;
  const msgEl = document.getElementById('forgotPasswordMsg');
  msgEl.className = 'error-msg hidden';
  msgEl.textContent = '';
  document.getElementById('forgotPasswordModal').classList.remove('hidden');
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.add('hidden');
}

async function handleForgotPassword() {
  const email = document.getElementById('forgotEmail').value.trim();
  const msgEl = document.getElementById('forgotPasswordMsg');
  msgEl.className = 'error-msg hidden';

  if (!email) {
    showError(msgEl, 'Please enter your account email.');
    return;
  }

  try {
    showLoading(true);
    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    showLoading(false);
    msgEl.className = 'success-msg';
    msgEl.textContent = 'Request sent. If this email is registered, the admin team will help reset your password after verification.';
    msgEl.classList.remove('hidden');
  } catch (e) {
    showLoading(false);
    showError(msgEl, e.message);
  }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!email || !password) {
    showError(errEl, 'Please fill in all fields.');
    return;
  }

  try {
    showLoading(true);
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    redirectByRole(data.user);
  } catch (e) {
    showLoading(false);
    showError(errEl, e.message);
  }
}

async function handleSignup() {
  const first = document.getElementById('signupFirst').value.trim();
  const last = document.getElementById('signupLast').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const course = document.getElementById('signupCourse').value;
  const password = document.getElementById('signupPassword').value;

  const errEl = document.getElementById('signupError');
  errEl.classList.add('hidden');

  if (!first || !last || !email || !course || !password) {
    showError(errEl, 'Please fill in all required fields.');
    return;
  }
  if (password.length < 8) {
    showError(errEl, 'Password must be at least 8 characters.');
    return;
  }

  try {
    showLoading(true);
    await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        firstName: first,
        lastName: last,
        email,
        phone,
        course,
        password
      })
    });

    showLoading(false);
    errEl.className = 'success-msg';
    errEl.textContent = 'Account created! Please wait for admin approval before logging in.';
    errEl.classList.remove('hidden');
  } catch (e) {
    showLoading(false);
    showError(errEl, e.message);
  }
}

async function checkExistingSession() {
  // Show maintenance banner on login page if enabled
  try {
    const maint = await apiFetch('/api/settings/maintenance');
    if (maint.enabled) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#fef3c7;color:#92400e;padding:12px 20px;text-align:center;font-size:0.9rem;font-weight:500;border-bottom:1px solid #fcd34d';
      banner.innerHTML = '🚧 <strong>Maintenance Mode is ON.</strong> Students cannot access the dashboard right now.';
      document.body.prepend(banner);
    }
  } catch (e) { /* ignore */ }

  const userData = await getCurrentUserData();
  if (userData) redirectByRole(userData);
  else showLoading(false);
}

function redirectByRole(userData) {
  // Prevent redirect loops for pending/suspended students
  if (userData.role === 'student' && userData.status !== 'active') {
    showLoading(false);
    const errEl = document.getElementById('loginError');
    if (errEl) {
      showError(errEl, `Account Status: ${userData.status.toUpperCase()}. Please wait for admin approval.`);
    }
    return;
  }

  if (userData.role === 'admin' || userData.role === 'faculty') {
    window.location.href = 'admin-dashboard.html';
  } else {
    window.location.href = 'student-dashboard.html';
  }
}

function showError(el, msg) {
  el.textContent = msg;
  el.className = 'error-msg';
  el.classList.remove('hidden');
}

function showLoading(show) {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = show ? 'flex' : 'none';
}

checkExistingSession();
