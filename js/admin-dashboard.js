// ============================================================
// AIMS LMS — Admin Dashboard Logic
// ============================================================

let allStudents = [];
let adminUser = null;
let adminRole = 'admin';

// Auth guard — admins and active faculty can use this dashboard.
(async function requireAdminOrFaculty() {
  const data = await getCurrentUserData();
  if (!data) { window.location.href = 'index.html'; return; }
  if (!['admin', 'faculty'].includes(data.role)) {
    if (data.role === 'student') window.location.href = 'student-dashboard.html';
    else window.location.href = 'index.html';
    return;
  }
  if (data.role === 'faculty' && data.status !== 'active') {
    window.location.href = 'index.html';
    return;
  }
  adminUser = data;
  adminRole = data.role;
  document.getElementById('sidebarName').textContent = `${data.firstName} ${data.lastName}`;
  document.getElementById('sidebarAvatar').textContent = data.firstName[0].toUpperCase();
  configureDashboardForRole();
  initAdmin();
})();

function initAdmin() {
  loadStudents();
  loadNotifications();
  loadAnnouncements();
  renderAdminPortals();
}

function isFaculty() {
  return adminRole === 'faculty';
}

function canManageStudents() {
  return adminRole === 'admin';
}

function configureDashboardForRole() {
  const roleLabel = isFaculty() ? 'Faculty' : 'Administrator';
  document.getElementById('dashboardBrand').textContent = isFaculty() ? 'AIMS Faculty' : 'AIMS Admin';
  document.getElementById('sidebarRole').textContent = roleLabel;
  document.getElementById('topRoleBadge').textContent = isFaculty() ? 'Faculty' : 'Admin';

  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.classList.toggle('hidden', !canManageStudents());
  });

  document.getElementById('totalStudentsLabel').textContent = isFaculty() ? 'Assigned Students' : 'Total Students';
  document.getElementById('pendingCard').classList.toggle('hidden', isFaculty());
  document.getElementById('revenueCard').classList.toggle('hidden', isFaculty());
  document.getElementById('pendingQuickView').classList.toggle('hidden', isFaculty());
  document.getElementById('studentsSectionTitle').textContent = isFaculty() ? 'Assigned Students' : 'Students';
  document.getElementById('notificationsSectionTitle').textContent = isFaculty() ? 'Notify Assigned Students' : 'Notifications';
}

// ============================================================
// Students
// ============================================================
async function loadStudents() {
  try {
    const data = await apiFetch('/api/students');
    allStudents = data.students;
    renderOverviewStats();
    renderPendingList();
    renderStudentsTable(allStudents);
    renderPayTable(allStudents);
    populateNotifStudentSelect(allStudents);
  } catch (err) {
    console.error(err);
    showToast('Unable to load students', 'error');
  }
}

function renderOverviewStats() {
  const total = allStudents.length;
  const pending = allStudents.filter(s => s.status === 'pending').length;
  const active = allStudents.filter(s => s.status === 'active').length;
  const revenue = allStudents.reduce((acc, s) => acc + (s.totalPaid || 0), 0);

  document.getElementById('ov-total').textContent = total;
  document.getElementById('ov-pending').textContent = pending;
  document.getElementById('ov-active').textContent = active;
  document.getElementById('ov-revenue').textContent = `৳${revenue.toLocaleString()}`;

  const badge = document.getElementById('pendingBadge');
  if (pending > 0) { badge.style.display = ''; badge.textContent = pending; }
  else { badge.style.display = 'none'; }
}

function renderPendingList() {
  const pending = allStudents.filter(s => s.status === 'pending');
  const container = document.getElementById('pendingList');
  if (pending.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--gray-400)">No pending approvals 🎉</div>';
    return;
  }
  container.innerHTML = pending.map(s => {
    const course = COURSES[s.course];
    return `
      <div class="pending-item">
        <div class="pending-info">
          <div class="pending-name">${s.firstName} ${s.lastName}</div>
          <div class="pending-meta">${s.email} · ${course ? course.name : s.course} · ${s.phone || 'No phone'}</div>
        </div>
        <div class="action-btns">
          <button class="btn-xs btn-xs-approve" onclick="approveStudent('${s.id}')">✓ Approve</button>
          <button class="btn-xs btn-xs-suspend" onclick="suspendStudent('${s.id}')">✗ Reject</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderStudentsTable(students) {
  const tbody = document.getElementById('studentsTable');
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--gray-400)">No students found.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s => {
    const course = COURSES[s.course];
    const statusClass = s.status === 'active' ? 'badge-success' : s.status === 'pending' ? 'badge-warning' : 'badge-danger';
    return `
      <tr>
        <td>
          <div style="font-weight:500">${s.firstName} ${s.lastName}</div>
          <div style="font-size:0.8rem;color:var(--gray-400)">${s.email}</div>
        </td>
        <td>${course ? course.name : s.course || '—'}</td>
        <td>৳${(s.totalPaid || 0).toLocaleString()}</td>
        <td style="color:${s.totalDue > 0 ? 'var(--danger)' : 'var(--gray-400)'}">৳${(s.totalDue || 0).toLocaleString()}</td>
        <td><span class="badge ${statusClass}">${s.status || 'pending'}</span></td>
        <td>
          <div class="action-btns">
            ${canManageStudents() && s.status === 'pending' ? `<button class="btn-xs btn-xs-approve" onclick="approveStudent('${s.id}')">Approve</button>` : ''}
            ${canManageStudents() ? `<button class="btn-xs btn-xs-edit" onclick="openEditStudent('${s.id}')">Edit</button>` : ''}
            ${canManageStudents() && s.status !== 'suspended' && s.status !== 'pending' ? `<button class="btn-xs btn-xs-suspend" onclick="suspendStudent('${s.id}')">Suspend</button>` : ''}
            ${canManageStudents() && s.status === 'suspended' ? `<button class="btn-xs btn-xs-approve" onclick="approveStudent('${s.id}')">Reactivate</button>` : ''}
            ${!canManageStudents() ? '<span style="font-size:0.8rem;color:var(--gray-400)">View only</span>' : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterStudents() {
  const q = document.getElementById('studentSearch').value.toLowerCase();
  const course = document.getElementById('courseFilter').value;
  const status = document.getElementById('statusFilter').value;
  const filtered = allStudents.filter(s => {
    const name = `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase();
    return (!q || name.includes(q)) &&
           (!course || s.course === course) &&
           (!status || s.status === status);
  });
  renderStudentsTable(filtered);
}

async function approveStudent(id) {
  if (!canManageStudents()) return;
  const student = allStudents.find(s => s.id === id);
  if (!student) return;
  await saveStudentPayload(id, { ...student, status: 'active' });
  await loadStudents();
  showToast('Student approved ✓', 'success');
}

async function suspendStudent(id) {
  if (!canManageStudents()) return;
  if (!confirm('Suspend/reject this student?')) return;
  const student = allStudents.find(s => s.id === id);
  if (!student) return;
  await saveStudentPayload(id, { ...student, status: 'suspended' });
  await loadStudents();
  showToast('Student suspended', 'info');
}

function saveStudentPayload(id, student) {
  return apiFetch(`/api/students/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone || '',
      course: student.course,
      status: student.status,
      totalPaid: student.totalPaid || 0,
      totalDue: student.totalDue || 0,
      studentId: student.studentId || '',
      assignedFacultyId: student.assignedFacultyId || ''
    })
  });
}

// ============================================================
// Edit Student Modal
// ============================================================
function openEditStudent(id) {
  if (!canManageStudents()) return;
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  document.getElementById('editStudentId').value = id;
  document.getElementById('editFirst').value = s.firstName || '';
  document.getElementById('editLast').value = s.lastName || '';
  document.getElementById('editPhone').value = s.phone || '';
  document.getElementById('editCourse').value = s.course || '';
  document.getElementById('editStatus').value = s.status || 'pending';
  document.getElementById('editPaid').value = s.totalPaid || 0;
  document.getElementById('editDue').value = s.totalDue || 0;
  document.getElementById('editStudentIdField').value = s.studentId || '';
  document.getElementById('editFacultyId').value = s.assignedFacultyId || '';
  document.getElementById('editStudentErr').classList.add('hidden');
  openModal('editStudentModal');
}

async function saveStudentEdit() {
  if (!canManageStudents()) return;
  const id = document.getElementById('editStudentId').value;
  const errEl = document.getElementById('editStudentErr');
  try {
    const course = document.getElementById('editCourse').value;
    const paid = parseFloat(document.getElementById('editPaid').value) || 0;
    const due = parseFloat(document.getElementById('editDue').value) || 0;

    await saveStudentPayload(id, {
      firstName: document.getElementById('editFirst').value.trim(),
      lastName: document.getElementById('editLast').value.trim(),
      phone: document.getElementById('editPhone').value.trim(),
      course,
      status: document.getElementById('editStatus').value,
      totalPaid: paid,
      totalDue: due,
      studentId: document.getElementById('editStudentIdField').value.trim(),
      assignedFacultyId: document.getElementById('editFacultyId').value.trim()
    });

    closeModal('editStudentModal');
    await loadStudents();
    showToast('Student updated ✓', 'success');
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

// ============================================================
// Add Student
// ============================================================
function openAddStudentModal() {
  if (!canManageStudents()) return;
  document.getElementById('addStudentErr').classList.add('hidden');
  ['addFirst','addLast','addEmail','addPhone','addPassword','addStudentId','addFacultyId'].forEach(id => {
    document.getElementById(id).value = '';
  });
  openModal('addStudentModal');
}

async function addStudent() {
  if (!canManageStudents()) return;
  const first = document.getElementById('addFirst').value.trim();
  const last = document.getElementById('addLast').value.trim();
  const email = document.getElementById('addEmail').value.trim();
  const phone = document.getElementById('addPhone').value.trim();
  const course = document.getElementById('addCourse').value;
  const password = document.getElementById('addPassword').value;
  const studentId = document.getElementById('addStudentId').value.trim();
  const assignedFacultyId = document.getElementById('addFacultyId').value.trim();
  const errEl = document.getElementById('addStudentErr');
  errEl.classList.add('hidden');

  if (!first || !last || !email || !course || !password) {
    errEl.textContent = 'Fill in all required fields.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch('/api/students', {
      method: 'POST',
      body: JSON.stringify({
        firstName: first,
        lastName: last,
        email,
        phone,
        course,
        password,
        studentId,
        assignedFacultyId
      })
    });

    closeModal('addStudentModal');
    await loadStudents();
    showToast('Student created ✓', 'success');
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

// ============================================================
// Notifications
// ============================================================
async function loadNotifications() {
  try {
    const data = await apiFetch('/api/notifications');
    renderNotifTable(data.notifications);
  } catch (err) {
    console.error(err);
    showToast('Unable to load notifications', 'error');
  }
}

function renderNotifTable(notifs) {
  const tbody = document.getElementById('notifTable');
  if (notifs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--gray-400)">No notifications sent yet.</td></tr>';
    return;
  }
  tbody.innerHTML = notifs.map(n => {
    const date = formatDate(n.createdAt);
    const target = getNotificationTargetLabel(n);
    return `
      <tr>
        <td>
          <div style="font-weight:500">${n.title}</div>
          <div style="font-size:0.8rem;color:var(--gray-400);margin-top:2px">${n.body.substring(0, 60)}${n.body.length > 60 ? '...' : ''}</div>
        </td>
        <td>${target}</td>
        <td>${date}</td>
        <td>
          <button class="btn-xs btn-xs-notif" onclick="deleteNotif('${n.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openNotifModal() {
  document.getElementById('notifTitle').value = '';
  document.getElementById('notifBody').value = '';
  setupNotificationTargets();
  document.getElementById('notifTarget').value = isFaculty() ? 'assigned' : 'all';
  document.getElementById('studentSelectField').classList.add('hidden');
  document.getElementById('notifModalErr').classList.add('hidden');
  openModal('notifModal');
}

function toggleStudentSelect() {
  const target = document.getElementById('notifTarget').value;
  const field = document.getElementById('studentSelectField');
  if (target === 'individual') field.classList.remove('hidden');
  else field.classList.add('hidden');
}

function setupNotificationTargets() {
  const sel = document.getElementById('notifTarget');
  sel.innerHTML = isFaculty()
    ? '<option value="assigned">👥 All Assigned Students</option><option value="individual">👤 Assigned Individual Student</option>'
    : '<option value="all">📢 All Students (Mass Notification)</option><option value="individual">👤 Individual Student</option>';
}

function getNotificationTargetLabel(n) {
  if (n.targetType === 'all') return '<span class="badge badge-teal">All Students</span>';
  if (n.targetType === 'assigned') return '<span class="badge badge-teal">Assigned Students</span>';
  return '<span class="badge badge-gold">Individual</span>';
}

function populateNotifStudentSelect(students) {
  const sel = document.getElementById('notifStudent');
  sel.innerHTML = students
    .filter(s => s.status === 'active')
    .map(s => `<option value="${s.id}">${s.firstName} ${s.lastName} (${s.email})</option>`)
    .join('');
}

async function sendNotification() {
  const target = document.getElementById('notifTarget').value;
  const title = document.getElementById('notifTitle').value.trim();
  const body = document.getElementById('notifBody').value.trim();
  const errEl = document.getElementById('notifModalErr');
  errEl.classList.add('hidden');

  if (!title || !body) {
    errEl.textContent = 'Please fill in title and message.';
    errEl.classList.remove('hidden');
    return;
  }

  const notifData = {
    title, body,
    targetType: target,
    sentBy: adminUser.id,
    senderRole: adminRole
  };

  if (target === 'assigned') {
    notifData.targetFacultyId = adminUser.id;
  }

  if (target === 'individual') {
    const studentId = document.getElementById('notifStudent').value;
    if (!studentId) {
      errEl.textContent = 'Select a student.';
      errEl.classList.remove('hidden');
      return;
    }
    const selectedStudent = allStudents.find(s => s.id === studentId);
    if (isFaculty() && (!selectedStudent || selectedStudent.assignedFacultyId !== adminUser.id)) {
      errEl.textContent = 'You can only notify students assigned to you.';
      errEl.classList.remove('hidden');
      return;
    }
    notifData.targetUserId = studentId;
    if (isFaculty()) notifData.targetFacultyId = adminUser.id;
  }

  try {
    await apiFetch('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(notifData)
    });
    closeModal('notifModal');
    await loadNotifications();
    showToast(`Notification sent to ${target === 'all' ? 'all students' : target === 'assigned' ? 'assigned students' : 'student'} ✓`, 'success');
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteNotif(id) {
  if (!confirm('Delete this notification?')) return;
  await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
  await loadNotifications();
  showToast('Notification deleted', 'info');
}

// ============================================================
// Payments
// ============================================================
function renderPayTable(students) {
  const tbody = document.getElementById('payTable');
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--gray-400)">No students.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s => {
    const course = COURSES[s.course];
    const totalFee = course ? course.totalFee : 0;
    return `
      <tr>
        <td>
          <div style="font-weight:500">${s.firstName} ${s.lastName}</div>
          <div style="font-size:0.8rem;color:var(--gray-400)">${s.studentId || s.email}</div>
        </td>
        <td>${course ? course.name : '—'}</td>
        <td>৳${totalFee.toLocaleString()}</td>
        <td style="color:var(--success);font-weight:500">৳${(s.totalPaid || 0).toLocaleString()}</td>
        <td style="color:${s.totalDue > 0 ? 'var(--danger)' : 'var(--gray-400)'};font-weight:500">৳${(s.totalDue || 0).toLocaleString()}</td>
        <td>
          ${canManageStudents() ? `<button class="btn-xs btn-xs-pay" onclick="openEditStudent('${s.id}')">Update Payment</button>` : '<span style="font-size:0.8rem;color:var(--gray-400)">View only</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function filterPayments() {
  const q = document.getElementById('paySearch').value.toLowerCase();
  const filtered = q ? allStudents.filter(s => `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(q)) : allStudents;
  renderPayTable(filtered);
}

// ============================================================
// Portals
// ============================================================
function renderAdminPortals() {
  const grid = document.getElementById('adminPortalsGrid');
  grid.innerHTML = PORTALS.map(p => `
    <a class="portal-card" href="${p.url}" target="${p.url.startsWith('http') ? '_blank' : '_self'}">
      <div class="portal-icon">${p.icon}</div>
      <div class="portal-name">${p.name}</div>
      <div class="portal-desc">${p.desc}</div>
      <div class="portal-arrow">→</div>
    </a>
  `).join('');
}

// ============================================================
// UI Helpers
// ============================================================
function showSection(name, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = {
    'overview': 'Overview',
    'students': 'Students',
    'notifications': 'Notifications',
    'payments': 'Payments',
    'announcements': 'Announcements',
    'portals': 'Portals'
  };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  closeSidebar();
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}


function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// Announcements / Ads
// ============================================================
async function loadAnnouncements() {
  try {
    const data = await apiFetch('/api/announcements');
    renderAnnouncementsList(data.announcements);
  } catch (e) {
    console.error(e);
  }
}

function renderAnnouncementsList(ads) {
  const container = document.getElementById('announcementsManageList');
  if (!ads || ads.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--gray-400)">No announcements yet. Click "+ New Announcement" to create one.</div>';
    return;
  }
  container.innerHTML = ads.map(ad => `
    <div style="border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)">
      <div style="background:${ad.bg_gradient};padding:20px 24px;color:white;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        ${ad.image_url ? `<img src="${ad.image_url}" style="width:120px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.style.display='none'">` : ''}
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600;font-size:1.1rem;margin-bottom:6px">${ad.title}</div>
          <div style="font-size:0.9rem;opacity:0.9;line-height:1.5">${ad.body || ''}</div>
          ${ad.link_url ? `<div style="margin-top:10px"><span style="background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:6px;font-size:0.85rem">${ad.link_text || 'Learn More'} →</span></div>` : ''}
        </div>
      </div>
      <div style="background:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.8rem;color:var(--gray-400)">Created: ${formatDate(ad.created_at)}</span>
        <button class="btn-xs btn-xs-suspend" onclick="deleteAd('${ad.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function openAnnouncementModal() {
  document.getElementById('adTitle').value = '';
  document.getElementById('adBody').value = '';
  document.getElementById('adImageUrl').value = '';
  document.getElementById('adLinkUrl').value = '';
  document.getElementById('adLinkText').value = 'Learn More';
  document.getElementById('adGradient').selectedIndex = 0;
  document.getElementById('adErr').classList.add('hidden');
  openModal('announcementModal');
}

async function createAnnouncement() {
  const title = document.getElementById('adTitle').value.trim();
  const body = document.getElementById('adBody').value.trim();
  const imageUrl = document.getElementById('adImageUrl').value.trim();
  const linkUrl = document.getElementById('adLinkUrl').value.trim();
  const linkText = document.getElementById('adLinkText').value.trim() || 'Learn More';
  const bgGradient = document.getElementById('adGradient').value;
  const errEl = document.getElementById('adErr');
  errEl.classList.add('hidden');

  if (!title) {
    errEl.textContent = 'Title is required.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch('/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, body, imageUrl, linkUrl, linkText, bgGradient })
    });
    closeModal('announcementModal');
    await loadAnnouncements();
    showToast('Announcement published ✓', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteAd(id) {
  if (!confirm('Delete this announcement?')) return;
  await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
  await loadAnnouncements();
  showToast('Announcement deleted', 'info');
}

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});
