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
  renderSchedule();
  renderStats();
  renderCourse();
  renderPayments();
  renderServices();
  renderProfile();
  loadCalendar();
  listenNotifications();
  loadAdBanners();
  initTheme();
}

function renderSchedule() {
  const daysEl = document.getElementById('statClassDays');
  const timeEl = document.getElementById('statClassTime');
  if (daysEl) daysEl.textContent = currentUser.classDays || 'Not set';
  if (timeEl) timeEl.textContent = currentUser.classTime || 'Not set';
}

// ============================================================
// Theme Management
// ============================================================
const THEMES = {
  teal: {
    primary: '#0D9488',
    dark: '#0F766E',
    light: '#F0FDFA',
    mid: '#2DD4BF',
    shadow: 'rgba(13,148,136,0.12)'
  },
  indigo: {
    primary: '#4338CA',
    dark: '#3730A3',
    light: '#EEF2FF',
    mid: '#6366F1',
    shadow: 'rgba(67,56,202,0.12)'
  },
  coral: {
    primary: '#FF7F50',
    dark: '#E35D44',
    light: '#FFF1EE',
    mid: '#FF9F7D',
    shadow: 'rgba(255,127,80,0.12)'
  },
  emerald: {
    primary: '#10B981',
    dark: '#065F46',
    light: '#ECFDF5',
    mid: '#34D399',
    shadow: 'rgba(16,185,129,0.12)'
  }
};

function initTheme() {
  const saved = localStorage.getItem('aims-theme') || 'teal';
  applyTheme(saved);
}

function applyTheme(name) {
  const theme = THEMES[name] || THEMES.teal;
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-dark', theme.dark);
  root.style.setProperty('--primary-light', theme.light);
  root.style.setProperty('--primary-mid', theme.mid);
  root.style.setProperty('--shadow', `0 4px 16px ${theme.shadow}`);
  root.style.setProperty('--shadow-lg', `0 8px 32px ${theme.shadow.replace('0.12', '0.18')}`);
  
  // Update sidebar gradient if needed (dashboard.css uses var(--teal-dark))
  localStorage.setItem('aims-theme', name);
  
  // Update UI selection state if palette exists
  document.querySelectorAll('.theme-opt').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === name);
  });
}

function renderSidebarUser() {
  const name = `${currentUser.firstName} ${currentUser.lastName}`;
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('sidebarAvatar').textContent = currentUser.firstName[0].toUpperCase();
}

function renderGreeting() {
  const hour = new Date().getHours();
  let greet = 'Good morning';
  let icon = '☀️';
  if (hour >= 12 && hour < 17) { greet = 'Good afternoon'; icon = '🌤️'; }
  else if (hour >= 17 && hour < 21) { greet = 'Good evening'; icon = '🌆'; }
  else if (hour >= 21 || hour < 5) { greet = 'Hello'; icon = '🌙'; }

  document.getElementById('greetName').textContent = `${greet}, ${currentUser.firstName}!`;
  document.getElementById('greetIcon').textContent = icon;
  
  const courseNames = getCourseNames(currentUser);
  document.getElementById('enrollStatus').textContent = `Enrolled in ${courseNames}`;
  
  startLiveClock();
}

function startLiveClock() {
  const clockEl = document.getElementById('liveClock');
  const dateEl = document.getElementById('liveDate');
  
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

function renderStats() {
  // Stats cards removed from UI
}

async function fetchLatestBroadcastForStat() {
  const el = document.getElementById('statLastBroadcast');
  if (!el) return;
  try {
    const notifications = await apiFetch('/api/notifications');
    const personal = await apiFetch(`/api/notifications/${currentUser.id}`);
    const all = [...notifications, ...personal].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (all.length > 0) {
      el.textContent = all[0].title;
    } else {
      el.textContent = 'No new messages';
    }
  } catch (e) {
    el.textContent = 'Check broadcasts';
  }
}

function renderCourse() {
  const courses = getCourseList(currentUser);
  const container = document.getElementById('courseContent');
  if (courses.length === 0) {
    container.innerHTML = '<div class="card" style="color:var(--gray-400);text-align:center;padding:48px">No course assigned yet.</div>';
    return;
  }

  // Enrollment and Expiry calc
  const enrollDate = currentUser.enrolledDate ? new Date(currentUser.enrolledDate) : null;
  let enrollStr = '—';
  let expiryStr = '—';
  if (enrollDate && !isNaN(enrollDate)) {
    enrollStr = formatDate(enrollDate);
    const expiryDate = new Date(enrollDate);
    expiryDate.setMonth(expiryDate.getMonth() + 6);
    expiryStr = formatDate(expiryDate);
  }

  container.innerHTML = courses.map(course => `
    <div class="course-card" style="margin-bottom:18px">
      <div class="course-header">
        <div class="course-name">${course.icon} ${course.name}</div>
        <div class="course-meta" style="flex-wrap:wrap">
          <span>⏱ ${course.duration}</span>
          <span>📅 ${course.sessions}</span>
          <span>💰 ৳${course.totalFee.toLocaleString()} total</span>
        </div>
      </div>
      <div class="course-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--gray-100)">
          <div style="background:var(--gray-50);padding:12px;border-radius:var(--radius-sm)">
            <div style="font-size:0.75rem;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">📅 Enrollment Date</div>
            <div style="font-weight:600;color:var(--gray-800)">${enrollStr}</div>
          </div>
          <div style="background:var(--teal-light);padding:12px;border-radius:var(--radius-sm)">
            <div style="font-size:0.75rem;color:var(--teal);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">⌛ Access Expiry</div>
            <div style="font-weight:700;color:var(--teal-dark)">${expiryStr}</div>
          </div>
        </div>

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
  `).join('');
}


function renderPayments() {
  const paid = currentUser.totalPaid || 0;
  const due = currentUser.totalDue || 0;
  const totalFee = getCourseTotalFee(currentUser);

  document.getElementById('pay-totalFee').textContent = `৳${totalFee.toLocaleString()}`;
  document.getElementById('pay-paid').textContent = `৳${paid.toLocaleString()}`;
  document.getElementById('pay-due').textContent = `৳${due.toLocaleString()}`;

  // Payment history
  apiFetch('/api/payments')
    .then(data => {
      const tbody = document.getElementById('paymentHistory');
      if (!data.payments || !data.payments.length) return;
      tbody.innerHTML = data.payments.map(p => `
        <tr>
          <td>${formatDate(p.date)}</td>
          <td>${p.description || 'Payment'}</td>
          <td>৳${(p.amount || 0).toLocaleString()}</td>
          <td><span class="badge badge-success">${p.status || 'Received'}</span></td>
        </tr>
      `).join('');
    }).catch(() => {});

  // NEW: Installment Plan
  apiFetch('/api/installments')
    .then(data => {
      const card = document.getElementById('installmentCard');
      const container = document.getElementById('installmentTimeline');
      if (!data.installments || !data.installments.length) {
        card.style.display = 'none';
        return;
      }
      card.style.display = 'block';
      container.innerHTML = data.installments.map(inst => {
        const date = formatDate(inst.dueDate);
        const status = inst.status || 'pending';
        return `
          <div class="installment-item ${status}">
            <div class="installment-dot"></div>
            <div class="installment-content">
              <div class="installment-info">
                <div class="installment-date">${date}</div>
                <div class="installment-desc">${inst.description || 'Scheduled Instalment'}</div>
                <div><span class="installment-status-badge status-${status}">${status}</span></div>
              </div>
              <div class="installment-amount">৳${inst.amount.toLocaleString()}</div>
            </div>
          </div>
        `;
      }).join('');
    }).catch(() => {});
}

// ============================================================
// Other Services
// ============================================================
async function renderServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  try {
    const data = await apiFetch('/api/services?t=' + Date.now());
    const services = data.services || [];
    if (services.length === 0) {
      grid.innerHTML = '<div style="text-align:center;padding:32px;color:var(--gray-400);grid-column:1/-1">No services available.</div>';
      return;
    }
    grid.innerHTML = services.map(p => `
      <a class="portal-card" href="${p.url}" target="${p.url.startsWith('http') ? '_blank' : '_self'}">
        <div class="portal-icon">${p.icon.startsWith('http') ? `<img src="${p.icon}" style="width:40px;height:40px;object-fit:contain">` : p.icon}</div>
        <div class="portal-name">${p.name}</div>
        <div class="portal-desc">${p.desc}</div>
        <div class="portal-arrow">→</div>
      </a>
    `).join('');
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div style="text-align:center;padding:32px;color:var(--gray-400);grid-column:1/-1">Failed to load services.</div>';
  }
}

function toggleDropdown() {
  document.getElementById('dropdownContent').classList.toggle('hidden');
}

async function loadCalendar() {
  const tbody = document.getElementById('calendarList');
  if (!tbody) return;
  try {
    const data = await apiFetch('/api/calendar?t=' + Date.now());
    if (data.calendar.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px">No events or holidays scheduled.</td></tr>';
      return;
    }
    tbody.innerHTML = data.calendar.map(c => `
      <tr>
        <td style="font-weight:600">${formatDate(c.date)}</td>
        <td><span class="badge badge-${c.type}">${c.type}</span></td>
        <td style="font-weight:500">${c.title}</td>
        <td style="font-size:0.85rem; color:var(--gray-600)">${c.desc}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function renderProfile() {
  const avatar = currentUser.firstName[0].toUpperCase();
  document.getElementById('profileAvatar').textContent = avatar;
  document.getElementById('profileName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
  document.getElementById('profileEmail').textContent = currentUser.email;

  const courseNames = getCourseNames(currentUser);

  let validityStr = '—';
  if (currentUser.enrolledDate) {
    const start = new Date(currentUser.enrolledDate);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setMonth(end.getMonth() + 6);
      validityStr = `${formatDate(start)} to ${formatDate(end)}`;
    }
  }

  const fields = [
    { label: 'Student ID', value: currentUser.studentId || '—' },
    { label: 'Phone', value: currentUser.phone || '—' },
    { label: 'Courses', value: courseNames },
    { label: 'Status', value: currentUser.status || '—' },
    { label: 'Course Validity', value: validityStr }
  ];

  document.getElementById('profileFields').innerHTML = fields.map(f => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100)">
      <span style="font-size:0.875rem;color:var(--gray-500)">${f.label}</span>
      <span style="font-size:0.9rem;font-weight:500;color:var(--gray-800)">${f.value}</span>
    </div>
  `).join('');
}

// Ad Banners — Slideshow
let _adSlideIndex = 0;
let _adSlideTimer = null;
let _adSlides = [];
let _adInitialized = false;

async function loadAdBanners() {
  if (_adInitialized) return;
  _adInitialized = true;
  
  try {
    const data = await apiFetch('/api/announcements?t=' + Date.now());
    const ads = data.announcements;
    console.log('Ads loaded:', ads);
    const container = document.getElementById('adBanners');
    if (!ads || ads.length === 0) { container.style.display = 'none'; return; }

    _adSlides = ads;
    container.style.display = 'block';

    // Build slideshow HTML
    const slidesHtml = ads.map((ad, i) => {
      const imgUrl = safeMediaUrl(ad.image_url || ad.imageUrl || '');
      const rawVideoUrl = ad.video_url || ad.videoUrl || '';
      const videoUrl = normalizeVideoEmbedUrl(rawVideoUrl);
      const linkUrl = safeExternalUrl(ad.link_url || ad.linkUrl || '');
      const linkText = escapeHtml(ad.link_text || ad.linkText || 'Learn More');
      const bgGradient = safeAnnouncementBackground(ad.bg_gradient || ad.bgGradient || 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)');
      const title = escapeHtml(ad.title || 'Announcement');
      const body = escapeHtml(ad.body || '');
      
      const hasImg = !!imgUrl;
      const hasVideo = !!videoUrl;
      const isGradient = !hasImg && !hasVideo;
      const slideClass = `ad-slide ${i === 0 ? 'active' : ''} ${isGradient ? 'ad-slide-gradient' : 'ad-slide-media'}`;
      const slideStyle = i === 0 ? 'flex' : 'none';
      const bgStyle = isGradient ? bgGradient : '#ffffff';

      return `
        <div class="${slideClass}" data-index="${i}" data-has-video="${hasVideo}" style="display:${slideStyle}; background:${bgStyle};">
          ${hasVideo ? `
            <div class="ad-video-container">
              <iframe src="${videoUrl}"
                title="Announcement video"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowfullscreen
                referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
          ` : hasImg ? `
            <div class="ad-image-container">
              <img src="${imgUrl}" alt="${title}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" onerror="this.closest('.ad-image-container').style.display='none'">
            </div>
          ` : `
            <div style="position:absolute; bottom:-10px; right:-10px; font-size:8rem; opacity:0.1; pointer-events:none">✨</div>
          `}
          <div class="ad-content">
            <div class="ad-content-kicker">AIMS Announcement</div>
            <div class="ad-content-title">${title}</div>
            <div class="ad-content-body">${body}</div>
            ${linkUrl ? `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="ad-link">${linkText} →</a>` : ''}
          </div>
        </div>`;
    }).join('');

    // Dot indicators
    const dotsHtml = ads.length > 1
      ? `<div class="ad-dots">${ads.map((_, i) => `<span class="ad-dot ${i === 0 ? 'active' : ''}" onclick="goToAdSlide(${i})"></span>`).join('')}</div>`
      : '';

    // Arrows (only if >1)
    const arrowsHtml = ads.length > 1
      ? `<button class="ad-arrow ad-arrow-prev" onclick="prevAdSlide()">&#8249;</button>
         <button class="ad-arrow ad-arrow-next" onclick="nextAdSlide()">&#8250;</button>`
      : '';

    container.innerHTML = `
      <div class="ad-slideshow" onmouseenter="pauseAdTimer()" onmouseleave="startAdTimer()">
        ${slidesHtml}
        ${arrowsHtml}
        ${dotsHtml}
      </div>`;

    if (ads.length > 1) startAdTimer();
  } catch (e) {
    console.error('Ad banners:', e);
  }
}

function safeAnnouncementBackground(value) {
  const background = String(value || '').trim();
  if (/^linear-gradient\([#%,.\s\w()-]+\)$/i.test(background)) return background;
  return 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)';
}

function startAdTimer() {
  if (_adSlideTimer) {
    clearInterval(_adSlideTimer);
    _adSlideTimer = null;
  }
  
  if (!_adSlides.length) return;
  const currentSlide = document.querySelector('.ad-slide[data-index="' + _adSlideIndex + '"]');
  // Don't auto-advance if it's a video
  if (currentSlide && currentSlide.dataset.hasVideo === 'true') return;

  _adSlideTimer = setInterval(function() { nextAdSlide(); }, 6000); // Slower interval
}

function pauseAdTimer() {
  if (_adSlideTimer) {
    clearInterval(_adSlideTimer);
    _adSlideTimer = null;
  }
}

function nextAdSlide() {
  goToAdSlide(_adSlideIndex + 1);
}

function prevAdSlide() {
  goToAdSlide(_adSlideIndex - 1);
}

function goToAdSlide(index) {
  const slides = document.querySelectorAll('.ad-slide');
  const dots = document.querySelectorAll('.ad-dot');
  if (!slides.length) return;
  
  slides[_adSlideIndex].style.display = 'none';
  if (dots[_adSlideIndex]) dots[_adSlideIndex].classList.remove('active');
  
  _adSlideIndex = (index + slides.length) % slides.length;
  
  slides[_adSlideIndex].style.display = 'flex';
  if (dots[_adSlideIndex]) dots[_adSlideIndex].classList.add('active');
  
  startAdTimer();
}



// Real-time notifications listener
async function listenNotifications() {
  if (notifUnsubscribe) notifUnsubscribe();

  try {
    const data = await apiFetch('/api/notifications?t=' + Date.now());
    const notifs = data.notifications;
    renderNotifications(notifs);

    // Notifications are now handled via renderNotifications and the dynamic stat card
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
    list.innerHTML = '<div class="notif-empty">No broadcasts yet</div>';
    if(pageList) pageList.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--gray-400);padding:32px">No broadcasts yet.</td></tr>';
    return;
  }

  list.innerHTML = notifs.map(n => {
    const isUnread = !readIds.includes(n.id);
    const date = formatDate(n.createdAt);
    return `
      <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="markRead('${n.id}')">
        ${n.imageUrl ? `<img src="${n.imageUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:10px">` : ''}
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
          <td>
            ${isUnread ? '<span class="nav-badge" style="display:inline-block;margin-right:8px">New</span>' : ''}
            ${n.title}
          </td>
          <td style="color:var(--gray-600)">
            ${n.imageUrl ? `<img src="${n.imageUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;margin-right:10px;vertical-align:middle">` : ''}
            ${n.body}
          </td>
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


// ============================================================
// Password Reset (Self-Service)
// ============================================================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

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
    showToast('Password changed successfully ✓', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
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
    'notifications': 'Broadcasts',
    'services': 'Other Services',
    'calendar': 'Academic Calendar',
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

function toggleMenu() {
  document.getElementById('topMenuDropdown').classList.toggle('hidden');
}

// Close dropdowns on outside click
window.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    const dropdown = document.getElementById('topMenuDropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }
});


function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
