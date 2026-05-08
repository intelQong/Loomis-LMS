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
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data;
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
