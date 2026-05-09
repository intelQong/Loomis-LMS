// ============================================================
// AIMS LMS — Student Dashboard Logic
// ============================================================

let currentUser = null;
let notifUnsubscribe = null;

// Auth guard
(async function requireStudent() {
  // Check maintenance mode first
  try {
    const maint = await apiFetch('/api/settings/maintenance');
    if (maint.enabled) {
      document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:white;font-family:'DM Sans',sans-serif;text-align:center;padding:40px">
          <div style="max-width:480px">
            <div style="font-size:4rem;margin-bottom:16px">🚧</div>
            <h1 style="font-size:2rem;font-weight:600;margin-bottom:12px">Under Maintenance</h1>
            <p style="font-size:1.1rem;opacity:0.8;line-height:1.7;margin-bottom:32px">
              AIMS English LMS is currently undergoing scheduled maintenance.<br>
              We'll be back shortly. Thank you for your patience!
            </p>
            <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:20px;backdrop-filter:blur(4px)">
              <div style="font-size:0.9rem;opacity:0.7;margin-bottom:8px">Need help? Contact us:</div>
              <a href="https://wa.me/8801805983999" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;font-size:0.9rem">
                📱 WhatsApp: 01805983999
              </a>
            </div>
          </div>
        </div>`;
      return;
    }
  } catch (e) {
    // If check fails, continue normally
  }

  const data = await getCurrentUserData();
  if (!data) {
    window.location.href = 'index.html';
    return;
  }
  if (data.role !== 'student' || data.status !== 'active') {
    if (data.role === 'admin' || data.role === 'faculty') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'index.html';
    }
    return;
  }
  currentUser = data;
  initDashboard();
})();

function initDashboard() {
  renderSidebarUser();
  renderGreeting();
  renderStats();
  renderCourse();
  renderPayments();
  renderPortals();
  renderProfile();
  listenNotifications();
  loadAdBanners();
}

function renderSidebarUser() {
  const name = `${currentUser.firstName} ${currentUser.lastName}`;
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('sidebarAvatar').textContent = currentUser.firstName[0].toUpperCase();
}

function renderGreeting() {
  const hour = new Date().getHours();
  let greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  let emoji = hour < 12 ? '☀️' : hour < 17 ? '📖' : '🌙';
  const course = COURSES[currentUser.course];
  document.getElementById('greetingName').textContent = `${greeting}, ${currentUser.firstName}!`;
  document.getElementById('greetingCourse').textContent = course ? `Enrolled in ${course.name}` : 'Welcome to AIMS English';
  document.getElementById('greetingEmoji').textContent = emoji;
}

function renderStats() {
  const course = COURSES[currentUser.course];

  document.getElementById('stat-course').textContent = course ? course.icon : '—';

  const statusBadge = currentUser.status === 'active' ? 'Active' : currentUser.status;
  document.getElementById('stat-status').textContent = statusBadge;
}

function renderCourse() {
  const course = COURSES[currentUser.course];
  const container = document.getElementById('courseContent');
  if (!course) {
    container.innerHTML = '<div class="card" style="color:var(--gray-400);text-align:center;padding:48px">No course assigned yet.</div>';
    return;
  }
  container.innerHTML = `
    <div class="course-card">
      <div class="course-header">
        <div class="course-name">${course.icon} ${course.name}</div>
        <div class="course-meta">
          <span>⏱ ${course.duration}</span>
          <span>📅 ${course.sessions}</span>
          <span>💰 ৳${course.totalFee.toLocaleString()} total</span>
        </div>
      </div>
      <div class="course-body">
        <div style="font-size:0.95rem;font-weight:600;color:var(--gray-700);margin-bottom:4px">What's included in your course:</div>
        <div class="features-grid">
          ${course.features.map(f => `
            <div class="feature-item">
              <span class="fi-icon">${f.icon}</span>
              <span>${f.label}</span>
              <span class="feature-check">✓</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:24px;padding:16px;background:var(--teal-light);border-radius:var(--radius-sm);font-size:0.875rem;color:var(--teal-dark)">
          🏅 <strong>British Council Affiliated</strong> — AIMS English is proud to be affiliated with the British Council, Chattogram.
        </div>
      </div>
    </div>
  `;
}

function renderPayments() {
  const course = COURSES[currentUser.course];
  const paid = currentUser.totalPaid || 0;
  const due = currentUser.totalDue || 0;
  const totalFee = course ? course.totalFee : 0;

  document.getElementById('pay-totalFee').textContent = `৳${totalFee.toLocaleString()}`;
  document.getElementById('pay-paid').textContent = `৳${paid.toLocaleString()}`;
  document.getElementById('pay-due').textContent = `৳${due.toLocaleString()}`;

  // Payment history from Cloudflare D1 (optional — admin adds entries)
  apiFetch('/api/payments')
    .then(data => {
      const tbody = document.getElementById('paymentHistory');
      if (!data.payments.length) return;
      tbody.innerHTML = data.payments.map(p => `
        <tr>
          <td>${formatDate(p.date)}</td>
          <td>${p.description || 'Payment'}</td>
          <td>৳${(p.amount || 0).toLocaleString()}</td>
          <td><span class="badge badge-success">${p.status || 'Received'}</span></td>
        </tr>
      `).join('');
    }).catch(() => {});
}

function renderPortals() {
  const grid = document.getElementById('portalsGrid');
  grid.innerHTML = PORTALS.map(p => `
    <a class="portal-card" href="${p.url}" target="${p.url.startsWith('http') ? '_blank' : '_self'}">
      <div class="portal-icon">${p.icon}</div>
      <div class="portal-name">${p.name}</div>
      <div class="portal-desc">${p.desc}</div>
      <div class="portal-arrow">→</div>
    </a>
  `).join('');
}

function renderProfile() {
  const avatar = currentUser.firstName[0].toUpperCase();
  document.getElementById('profileAvatar').textContent = avatar;
  document.getElementById('profileName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
  document.getElementById('profileEmail').textContent = currentUser.email;

  const course = COURSES[currentUser.course];
  const fields = [
    { label: 'Student ID', value: currentUser.studentId || '—' },
    { label: 'Phone', value: currentUser.phone || '—' },
    { label: 'Course', value: course ? course.name : '—' },
    { label: 'Status', value: currentUser.status || '—' },
    { label: 'Enrolled', value: formatDate(currentUser.enrolledDate) }
  ];

  document.getElementById('profileFields').innerHTML = fields.map(f => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100)">
      <span style="font-size:0.875rem;color:var(--gray-500)">${f.label}</span>
      <span style="font-size:0.9rem;font-weight:500;color:var(--gray-800)">${f.value}</span>
    </div>
  `).join('');
}

// Ad Banners
async function loadAdBanners() {
  try {
    const data = await apiFetch('/api/announcements');
    const ads = data.announcements;
    const container = document.getElementById('adBanners');
    if (!ads || ads.length === 0) { container.style.display = 'none'; return; }

    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    container.innerHTML = ads.map(ad => {
      const imgUrl = ad.image_url || ad.imageUrl || 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=400&q=80';
      const linkUrl = ad.link_url || ad.linkUrl;
      const linkText = ad.link_text || ad.linkText || 'Learn More';
      const bgGradient = ad.bg_gradient || ad.bgGradient || 'var(--teal)';

      return `
      <div class="announcement-card" style="background:${bgGradient};border-radius:var(--radius-lg);color:white;position:relative;overflow:hidden;display:flex;flex-wrap:wrap">
        <img src="${imgUrl}" style="width:180px;min-height:120px;object-fit:cover;flex-shrink:0;background:rgba(0,0,0,0.1)" alt="${ad.title}">
        <div style="flex:1;min-width:200px;padding:20px 24px;position:relative">
          <div style="position:absolute;top:-20px;right:-10px;font-size:4rem;opacity:0.08;pointer-events:none">📢</div>
          <div style="font-weight:600;font-size:1.05rem;margin-bottom:6px">${ad.title}</div>
          ${ad.body ? `<div style="font-size:0.9rem;opacity:0.9;line-height:1.5">${ad.body}</div>` : ''}
          ${linkUrl ? `<a href="${linkUrl}" target="_blank" style="display:inline-block;margin-top:12px;background:rgba(255,255,255,0.2);color:white;text-decoration:none;padding:8px 18px;border-radius:8px;font-size:0.85rem;font-weight:500;backdrop-filter:blur(4px);transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.35)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">${linkText} →</a>` : ''}
        </div>
      </div>
    `}).join('');
  } catch (e) {
    console.error('Ad banners:', e);
  }
}

// Real-time notifications listener
async function listenNotifications() {
  if (notifUnsubscribe) notifUnsubscribe();

  try {
    const data = await apiFetch('/api/notifications');
    const notifs = data.notifications;
    renderNotifications(notifs);

    // Latest for overview
    if (notifs.length > 0) {
      const latest = notifs[0];
      document.getElementById('latestNotif').innerHTML = `
        <div style="font-weight:500;color:var(--gray-800);margin-bottom:6px">${latest.title}</div>
        <div style="font-size:0.875rem;color:var(--gray-600);line-height:1.6">${latest.body}</div>
        <div style="font-size:0.75rem;color:var(--gray-400);margin-top:8px">${formatDate(latest.createdAt)}</div>
      `;
    }
  } catch (e) {
    renderNotifications([]);
  }
}

function renderNotifications(notifs) {
  const list = document.getElementById('notifList');
  const pageList = document.getElementById('pageNotifList');
  const dot = document.getElementById('notifDot');
  const badge = document.getElementById('sidebarNotifBadge');
  const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
  const unread = notifs.filter(n => !readIds.includes(n.id));

  if (unread.length > 0) {
    dot.classList.remove('hidden');
    badge.style.display = '';
    badge.textContent = unread.length;
  } else {
    dot.classList.add('hidden');
    badge.style.display = 'none';
  }

  if (notifs.length === 0) {
    list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    if(pageList) pageList.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--gray-400);padding:32px">No notifications yet.</td></tr>';
    return;
  }

  list.innerHTML = notifs.map(n => {
    const isUnread = !readIds.includes(n.id);
    const date = formatDate(n.createdAt);
    return `
      <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="markRead('${n.id}')">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-body">${n.body}</div>
        <div class="notif-item-time">${date}</div>
      </div>
    `;
  }).join('');

  if (pageList) {
    pageList.innerHTML = notifs.map(n => {
      const isUnread = !readIds.includes(n.id);
      const date = formatDate(n.createdAt);
      return `
        <tr style="cursor:pointer; ${isUnread ? 'background:var(--gray-50);font-weight:500;' : ''}" onclick="markRead('${n.id}')">
          <td>${n.title} ${isUnread ? '<span class="nav-badge" style="display:inline-block;margin-left:8px">New</span>' : ''}</td>
          <td style="color:var(--gray-600)">${n.body}</td>
          <td style="color:var(--gray-400)">${date}</td>
        </tr>
      `;
    }).join('');
  }
}

function markRead(id) {
  const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
  if (!readIds.includes(id)) {
    readIds.push(id);
    localStorage.setItem('readNotifs', JSON.stringify(readIds));
  }
  // Re-fetch or re-render is better, but we can just trigger listenNotifications()
  listenNotifications();
}

// UI helpers
function showSection(name, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');

  const titles = {
    'overview': 'Overview',
    'my-course': 'My Course',
    'payments': 'Payments',
    'notifications': 'Notifications',
    'portals': 'Portals',
    'profile': 'My Profile'
  };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

function toggleNotifPanel() {
  document.getElementById('notifPanel').classList.toggle('open');
}


function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
