// ============================================================
// Loomis LMS — Cloudflare Pages Functions API Client & Shared UI
// ============================================================

async function apiFetch(path, options = {}) {
  const { headers = {}, ...fetchOptions } = options;
  const res = await fetch(path, {
    credentials: 'include',
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || friendlyHttpError(path, res.status));
  }

  return data;
}

async function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}

function friendlyHttpError(path, status) {
  if (path.includes('/api/auth/login') && (status === 401 || status === 403)) {
    return 'Wrong username or password, Try Again.';
  }
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return 'You are not allowed to perform this action.';
  if (status === 429) return 'Too many attempts. Please wait and try again.';
  if (status >= 500) return 'Server error. Please try again in a moment.';
  return `Request failed with status ${status}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeExternalUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value), window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function safeMediaUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value), window.location.origin);
    if (!['http:', 'https:', 'data:'].includes(url.protocol)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function safeAnnouncementBackground(value) {
  const background = String(value || '').trim();
  if (background === 'var(--primary)' || /^linear-gradient\([#%,.\s\w()-]+\)$/i.test(background)) {
    return background;
  }
  return 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)';
}

function normalizeVideoEmbedUrl(value) {
  if (!value) return '';
  let finalUrl = String(value).trim();

  if (finalUrl.startsWith('<') && finalUrl.includes('iframe')) {
    const srcMatch = finalUrl.match(/src=["']([^"']+)["']/i);
    finalUrl = srcMatch ? srcMatch[1] : '';
  }

  try {
    const url = new URL(finalUrl);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' && url.pathname === '/watch') {
      const videoId = url.searchParams.get('v');
      return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : '';
    }

    if (host === 'youtu.be') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : '';
    }

    if ((host === 'youtube.com' || host === 'youtube-nocookie.com') && url.pathname.startsWith('/embed/')) {
      return url.href.replace('youtube.com/embed/', 'youtube-nocookie.com/embed/');
    }

    if (host === 'vimeo.com') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${encodeURIComponent(videoId)}` : '';
    }

    return url.href;
  } catch {
    return '';
  }
}

async function getCurrentUserData() {
  try {
    const data = await apiFetch('/api/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : '—';
}

async function handleLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
  window.location.href = 'index.html';
}

// Modal & Sidebar Controls
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function startLiveClock() {
  const clockEl = document.getElementById('liveClock');
  const dateEl = document.getElementById('liveDate');
  if (!clockEl || !dateEl) return;

  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    dateEl.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  update();
  setInterval(update, 1000);
}

function openChangePasswordModal() {
  document.getElementById('ownCurrentPassword').value = '';
  document.getElementById('ownNewPassword').value = '';
  document.getElementById('ownConfirmPassword').value = '';
  document.getElementById('ownPasswordErr').classList.add('hidden');
  openModal('changePasswordModal');
}

async function saveOwnPassword() {
  const currentPassword = document.getElementById('ownCurrentPassword').value;
  const newPassword = document.getElementById('ownNewPassword').value;
  const confirmPassword = document.getElementById('ownConfirmPassword').value;
  const errEl = document.getElementById('ownPasswordErr');

  errEl.classList.add('hidden');
  if (!currentPassword) {
    errEl.textContent = 'Current password is required.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    errEl.textContent = 'New password must be at least 8 characters.';
    errEl.classList.remove('hidden');
    return;
  }
  if (newPassword !== confirmPassword) {
    errEl.textContent = 'New passwords do not match.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    closeModal('changePasswordModal');
    showToast('Password changed successfully', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}
