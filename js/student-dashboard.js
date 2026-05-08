// ============================================================
// AIMS LMS — Student Dashboard Logic
// ============================================================

let currentUser = null;
let notifUnsubscribe = null;

// Auth guard
(async function requireStudent() {
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
  const paid = currentUser.totalPaid || 0;
  const due = currentUser.totalDue || 0;
  const pct = course ? Math.round((paid / course.totalFee) * 100) : 0;

  document.getElementById('stat-course').textContent = course ? course.icon : '—';
  document.getElementById('stat-paid').textContent = `৳${paid.toLocaleString()}`;
  document.getElementById('stat-due').textContent = `৳${due.toLocaleString()}`;

  const statusBadge = currentUser.status === 'active' ? 'Active' : currentUser.status;
  document.getElementById('stat-status').textContent = statusBadge;

  // Payment bar
  document.getElementById('paidLabel').textContent = `Paid: ৳${paid.toLocaleString()}`;
  document.getElementById('dueLabel').textContent = `Due: ৳${due.toLocaleString()}`;
  document.getElementById('payBar').style.width = `${Math.min(pct, 100)}%`;
  document.getElementById('payPercent').textContent = `${pct}% of total fee paid`;
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
  const dot = document.getElementById('notifDot');
  const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
  const unread = notifs.filter(n => !readIds.includes(n.id));

  if (unread.length > 0) {
    dot.classList.remove('hidden');
  } else {
    dot.classList.add('hidden');
  }

  if (notifs.length === 0) {
    list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
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
}

function markRead(id) {
  const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
  if (!readIds.includes(id)) {
    readIds.push(id);
    localStorage.setItem('readNotifs', JSON.stringify(readIds));
  }
  // Re-render
  const el = document.querySelector(`[onclick="markRead('${id}')"]`);
  if (el) el.classList.remove('unread');
  document.getElementById('notifDot').classList.add('hidden');
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
