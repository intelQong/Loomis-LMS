// ============================================================
// AIMS LMS — Cloudflare Pages Functions API Client
// ============================================================

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
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


function friendlyHttpError(path, status) {
  if (path.includes('/api/auth/login') && (status === 401 || status === 403)) {
    return 'Invalid email or password.';
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
  } catch (e) {
    return null;
  }
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function formatDate(value) {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : '—';
}

async function handleLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
  window.location.href = 'index.html';
}

function getValidityEnd(enrolledDate) {
  if (!enrolledDate) return null;
  const d = new Date(enrolledDate);
  d.setMonth(d.getMonth() + 6);
  return d;
}

function formatValidity(enrolledDate) {
  const d = getValidityEnd(enrolledDate);
  return d ? d.toLocaleDateString('en-GB') : '—';
}
