// ============================================================
// Learning Portal — Admin Dashboard Logic
// ============================================================

let allStudents = [];
let adminUser = null;
let adminRole = 'admin';

// Auth guard — admins and active faculty can use this dashboard.
(async function requireAdminOrFaculty() {
  const data = await getCurrentUserData();
  if (!data) { window.location.href = 'index.html'; return; }

  // Check maintenance mode
  try {
    const maint = await apiFetch('/api/settings/maintenance');
    if (maint.enabled && !data.isSuperAdmin) {
      document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:white;font-family:'Inter',sans-serif;text-align:center;padding:40px">
          <div style="max-width:500px">
            <div style="font-size:0.8rem;font-weight:700;letter-spacing:0.08em;margin-bottom:24px;text-transform:uppercase">System notice</div>
            <h1 style="font-size:2rem;font-weight:600;margin-bottom:16px">Maintenance in Progress</h1>
            <p style="font-size:1.1rem;opacity:0.8;line-height:1.7;margin-bottom:32px">
              The learning portal is currently undergoing essential administrative maintenance.<br><br>
              Access to this portal is restricted to the <strong>System Developer / Super Admin</strong> at this time.
            </p>
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;backdrop-filter:blur(8px)">
              <p style="font-size:0.9rem;opacity:0.7;margin-bottom:12px">If you are a student, please wait for the site to go live.</p>
              <button onclick="window.location.href='index.html'" style="background:var(--white);color:var(--gray-900);border:none;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer">Back to Login</button>
            </div>
          </div>
        </div>`;
      return;
    }
  } catch (e) {
    console.error('Maintenance check failed:', e);
  }

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
  loadServices();
  loadMaintenanceStatus();
  loadCalendar();
  renderGreeting();
  startLiveClock();
  checkSuperAdmin();
  initAttendance();
}

function renderGreeting() {
  const hour = new Date().getHours();
  let greet = 'Good morning';
  if (hour >= 12 && hour < 17) greet = 'Good afternoon';
  else if (hour >= 17 && hour < 21) greet = 'Good evening';
  else if (hour >= 21 || hour < 5) greet = 'Hello';

  const greetEl = document.getElementById('greetName');
  if (greetEl) greetEl.textContent = `${greet}, ${adminUser.firstName}!`;
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

function isFaculty() {
  return adminRole === 'faculty';
}

function canManageStudents() {
  return adminRole === 'admin';
}

function canEditStudentInfo() {
  return ['admin', 'faculty'].includes(adminRole);
}

function configureDashboardForRole() {
  const roleLabel = isFaculty() ? 'Faculty' : 'Administrator';
  document.getElementById('dashboardBrand').textContent = isFaculty() ? 'Faculty Portal' : 'Admin Portal';
  document.getElementById('sidebarRole').textContent = roleLabel;
  document.getElementById('topRoleBadge').textContent = isFaculty() ? 'Faculty' : 'Admin';

  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.classList.toggle('hidden', !canManageStudents());
  });

  document.getElementById('totalStudentsLabel').textContent = isFaculty() ? 'Assigned Students' : 'Total Students';
  document.getElementById('pendingCard').classList.toggle('hidden', isFaculty());
  document.getElementById('revenueCard').classList.toggle('hidden', isFaculty());
  document.getElementById('dueCollectionCard').classList.toggle('hidden', isFaculty());
  document.getElementById('pendingQuickView').classList.toggle('hidden', isFaculty());
  document.getElementById('studentsSectionTitle').textContent = isFaculty() ? 'Assigned Students' : 'Students';
  const addStudentBtn = document.getElementById('addStudentBtn');
  if (addStudentBtn) addStudentBtn.textContent = isFaculty() ? '+ Add Assigned Student' : '+ Add Student';
  document.getElementById('notificationsSectionTitle').textContent = isFaculty() ? 'Send Broadcast' : 'Broadcasts';
}

function handleFileSelect(input, urlId, previewId) {
  const file = input.files[0];
  if (!file) return;

  const fileNameSpan = document.getElementById(input.id + 'Name');
  if (fileNameSpan) fileNameSpan.textContent = file.name;

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64 = e.target.result;
    document.getElementById(urlId).value = base64;
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.style.display = 'block';
      preview.querySelector('img').src = base64;
    }
  };
  reader.readAsDataURL(file);
}


// ============================================================
// Academic Calendar Management
// ============================================================
async function loadCalendar() {
  try {
    const data = await apiFetch('/api/calendar?t=' + Date.now());
    const tbody = document.getElementById('adminCalendarList');
    if (!tbody) return;

    if (data.calendar.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--gray-400)">No entries yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.calendar.map(c => `
      <tr>
        <td style="font-weight:600">${formatDate(c.date)}</td>
        <td><span class="badge badge-${c.type}">${c.type}</span></td>
        <td style="font-weight:500">${c.title}</td>
        <td>
          <button class="btn-xs btn-xs-suspend" onclick="deleteCalendarEntry('${c.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function openCalendarModal() {
  document.getElementById('calTitle').value = '';
  document.getElementById('calDate').value = '';
  document.getElementById('calType').value = 'event';
  document.getElementById('calDesc').value = '';
  document.getElementById('calErr').classList.add('hidden');
  openModal('calendarModal');
}

async function createCalendarEntry() {
  const title = document.getElementById('calTitle').value.trim();
  const date = document.getElementById('calDate').value;
  const type = document.getElementById('calType').value;
  const desc = document.getElementById('calDesc').value.trim();
  const errEl = document.getElementById('calErr');

  if (!title || !date) {
    errEl.textContent = 'Title and Date are required.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch('/api/calendar', {
      method: 'POST',
      body: JSON.stringify({ title, date, type, desc })
    });
    closeModal('calendarModal');
    loadCalendar();
    showToast('Calendar entry added', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteCalendarEntry(id) {
  if (!confirm('Delete this calendar entry?')) return;
  try {
    await apiDelete(`/api/calendar/${encodeURIComponent(id)}`);
    loadCalendar();
    showToast('Entry deleted', 'info');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ============================================================
// Students
// ============================================================
let allInstallments = [];

async function loadStudents() {
  try {
    const data = await apiFetch('/api/students');
    allStudents = data.students;

    // Also fetch all installments for financial insights
    try {
      const instData = await apiFetch('/api/installments');
      allInstallments = instData.installments || [];
    } catch (e) {
      console.warn('Could not load all installments for stats', e);
      allInstallments = [];
    }

    renderOverviewStats();
    renderPendingList();
    renderStudentsTable(allStudents);
    filterPayments();
    populateNotifStudentSelect(allStudents);
  } catch (err) {
    console.error(err);
    showToast(`Unable to load students: ${err.message}`, 'error');
  }
}

function renderOverviewStats() {
  const period = document.getElementById('statPeriod') ? document.getElementById('statPeriod').value : 'month';
  const now = new Date();

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filterFn = (dateStr) => {
    if (period === 'all') return true;
    const d = new Date(dateStr);
    if (period === 'today') return d >= startOfDay;
    if (period === 'week') return d >= startOfWeek;
    if (period === 'month') return d >= startOfMonth;
    return true;
  };

  // 1. Basic counts
  const total = allStudents.length;
  const pending = allStudents.filter(s => s.status === 'pending').length;
  const active = allStudents.filter(s => s.status === 'active').length;

  document.getElementById('ov-total').textContent = total;
  document.getElementById('ov-pending').textContent = pending;

  // 2. Financials from installments
  // Total Collected for period = paid installments with dueDate in period
  const revenue = allInstallments
    .filter(i => i.status === 'paid' && filterFn(i.dueDate))
    .reduce((acc, i) => acc + (i.amount || 0), 0);

  // Due Collection for period = pending/overdue installments with dueDate in period
  const dueCollection = allInstallments
    .filter(i => i.status !== 'paid' && filterFn(i.dueDate))
    .reduce((acc, i) => acc + (i.amount || 0), 0);

  // Fallback for "All Time" Revenue: if allInstallments is empty, use totalPaid from student records
  const displayedRevenue = (period === 'all' && revenue === 0)
    ? allStudents.reduce((acc, s) => acc + (s.totalPaid || 0), 0)
    : revenue;

  document.getElementById('ov-revenue').textContent = `৳${displayedRevenue.toLocaleString()}`;
  const dueEl = document.getElementById('ov-due-collection');
  if (dueEl) dueEl.textContent = `৳${dueCollection.toLocaleString()}`;

  const badge = document.getElementById('pendingBadge');
  if (badge) {
    if (pending > 0) { badge.style.display = ''; badge.textContent = pending; }
    else { badge.style.display = 'none'; }
  }
}


function getSelectedCourseIds(selectId) {
  const select = document.getElementById(selectId);
  return Array.from(select.selectedOptions).map(option => option.value).filter(id => COURSES[id]);
}

function setSelectedCourseIds(selectId, courseIds) {
  const selected = new Set(courseIds);
  document.querySelectorAll(`#${selectId} option`).forEach(option => {
    option.selected = selected.has(option.value);
  });
}

function renderPendingList() {
  const pending = allStudents.filter(s => s.status === 'pending');
  const container = document.getElementById('pendingList');
  if (pending.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray-400);grid-column: 1/-1;">No pending approvals 🎉</div>';
    return;
  }
  container.innerHTML = pending.map(s => {
    const courseNames = getCourseNames(s);
    return `
      <div class="pending-item" style="border: 1px solid var(--gray-100); padding: 12px; border-radius: 10px; background: var(--gray-50); display: flex; flex-direction: column; gap: 8px;">
        <div class="pending-info" style="margin:0">
          <div class="pending-name" style="font-size: 0.95rem; font-weight: 600;">${s.firstName} ${s.lastName}</div>
          <div class="pending-meta" style="font-size: 0.8rem; line-height: 1.4;">
            ${courseNames}<br>
            <span style="color:var(--gray-400)">${s.phone || s.email}</span>
          </div>
        </div>
        <div class="action-btns" style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--gray-200); display: flex; gap: 8px;">
          ${canManageStudents() ? `
            <button class="btn-xs btn-xs-approve" style="flex:1" onclick="approveStudent('${s.id}')">Approve</button>
            <button class="btn-xs btn-xs-suspend" style="flex:1" onclick="suspendStudent('${s.id}')">Reject</button>
          ` : '<span style="font-size:0.8rem;color:var(--gray-400);text-align:center;width:100%">Admin only</span>'}
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
    const courseNames = getCourseNames(s);
    const statusClass = s.status === 'active' ? 'badge-success' : s.status === 'pending' ? 'badge-warning' : 'badge-danger';

    // Enrollment and Expiry calc
    const enrollDate = s.enrolledDate ? new Date(s.enrolledDate) : null;
    let expiryStr = '—';
    if (enrollDate && !isNaN(enrollDate)) {
      const expiryDate = new Date(enrollDate);
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      expiryStr = formatDate(expiryDate);
    }

    return `
      <tr>
        <td>
          <div style="font-weight:500">${s.firstName} ${s.lastName}</div>
          <div style="font-size:0.8rem;color:var(--gray-400)">${s.email}</div>
        </td>
        <td>${courseNames}</td>
        <td><span class="badge ${statusClass}">${s.status || 'pending'}</span></td>
        <td>${s.enrolledDate ? formatDate(s.enrolledDate) : '—'}</td>
        <td style="font-weight:500;color:var(--teal)">${expiryStr}</td>
        <td>
          <div class="action-btns">
            ${canManageStudents() && s.status === 'pending' ? `<button class="btn-xs btn-xs-approve" onclick="approveStudent('${s.id}')">Approve</button>` : ''}
            ${canEditStudentInfo() ? `<button class="btn-xs btn-xs-edit" onclick="openEditStudent('${s.id}')">Edit</button>` : ''}
            ${canManageStudents() ? `<button class="btn-xs" style="background:var(--gray-100);color:var(--gray-700)" onclick="openResetPasswordModal('${s.id}')">🔑</button>` : ''}
            ${canManageStudents() && s.status !== 'suspended' && s.status !== 'pending' ? `<button class="btn-xs btn-xs-suspend" onclick="suspendStudent('${s.id}')">Suspend</button>` : ''}
            ${canManageStudents() && s.status === 'suspended' ? `<button class="btn-xs btn-xs-approve" onclick="approveStudent('${s.id}')">Reactivate</button>` : ''}
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
      (!course || getCourseIds(s).includes(course)) &&
      (!status || s.status === status);
  });
  renderStudentsTable(filtered);
}

async function approveStudent(id) {
  if (!canManageStudents()) return;
  const student = allStudents.find(s => s.id === id);
  if (!student) return;
  try {
    await saveStudentPayload(id, { ...student, status: 'active' });
    await loadStudents();
    showToast('Student approved', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to approve: ' + e.message, 'error');
  }
}

async function suspendStudent(id) {
  if (!canManageStudents()) return;
  if (!confirm('Suspend/reject this student?')) return;
  const student = allStudents.find(s => s.id === id);
  if (!student) return;
  try {
    await saveStudentPayload(id, { ...student, status: 'suspended' });
    await loadStudents();
    showToast('Student suspended', 'info');
  } catch (e) {
    console.error(e);
    showToast('Failed to suspend: ' + e.message, 'error');
  }
}

function saveStudentPayload(id, student) {
  return apiFetch(`/api/students/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone || '',
      course: student.course,
      courses: student.courses || (student.course ? [student.course] : []),
      status: student.status,
      totalPaid: student.totalPaid || 0,
      totalDue: student.totalDue || 0,
      discount: student.discount || 0,
      nextPaymentDate: student.nextPaymentDate || '',
      studentId: student.studentId || '',
      assignedFacultyId: student.assignedFacultyId || '',
      enrolledDate: student.enrolledDate || '',
      classDays: student.classDays || '',
      classTime: student.classTime || ''
    })
  });
}

// ============================================================
// Edit Student Modal
// ============================================================
function openEditStudent(id) {
  if (!canEditStudentInfo()) return;
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  document.getElementById('editStudentId').value = id;
  document.getElementById('editFirst').value = s.firstName || '';
  document.getElementById('editLast').value = s.lastName || '';
  document.getElementById('editPhone').value = s.phone || '';
  setSelectedCourseIds('editCourse', getCourseIds(s));
  document.getElementById('editStatus').value = s.status || 'pending';
  document.getElementById('editStudentIdField').value = s.studentId || '';
  document.getElementById('editFacultyId').value = isFaculty() ? adminUser.id : (s.assignedFacultyId || '');
  document.getElementById('editFacultyId').readOnly = isFaculty();
  document.getElementById('editStatus').disabled = isFaculty();
  document.getElementById('editEnrolledDate').value = s.enrolledDate ? s.enrolledDate.split('T')[0] : '';
  document.getElementById('editClassDays').value = s.classDays || '';
  document.getElementById('editClassTime').value = s.classTime || '';
  document.getElementById('editStudentErr').classList.add('hidden');
  openModal('editStudentModal');
}

async function saveStudentEdit() {
  if (!canEditStudentInfo()) return;
  const id = document.getElementById('editStudentId').value;
  const errEl = document.getElementById('editStudentErr');
  try {
    const courses = getSelectedCourseIds('editCourse');
    const course = courses[0] || '';
    const existing = allStudents.find(x => x.id === id);
    const paid = existing ? (existing.totalPaid || 0) : 0;
    const due = existing ? (existing.totalDue || 0) : 0;

    await saveStudentPayload(id, {
      firstName: document.getElementById('editFirst').value.trim(),
      lastName: document.getElementById('editLast').value.trim(),
      phone: document.getElementById('editPhone').value.trim(),
      course,
      courses,
      status: isFaculty() && existing ? existing.status : document.getElementById('editStatus').value,
      totalPaid: paid,
      totalDue: due,
      studentId: document.getElementById('editStudentIdField').value.trim(),
      assignedFacultyId: isFaculty() ? adminUser.id : document.getElementById('editFacultyId').value.trim(),
      enrolledDate: document.getElementById('editEnrolledDate').value,
      classDays: document.getElementById('editClassDays').value.trim(),
      classTime: document.getElementById('editClassTime').value.trim()
    });

    closeModal('editStudentModal');
    await loadStudents();
    showToast('Student updated', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

// ============================================================
// Add Student
// ============================================================
function openAddStudentModal() {
  if (!canEditStudentInfo()) return;
  document.getElementById('addStudentErr').classList.add('hidden');
  ['addFirst', 'addLast', 'addEmail', 'addPhone', 'addPassword', 'addStudentId', 'addFacultyId', 'addEnrolledDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Default selections
  setSelectedCourseIds('addCourse', []);
  document.getElementById('addFacultyId').value = isFaculty() ? adminUser.id : '';
  document.getElementById('addFacultyId').readOnly = isFaculty();
  document.getElementById('addClassDays').value = 'Sat, Mon, Wed';
  document.getElementById('addClassTime').value = '4:00 PM';
  // Default to today
  document.getElementById('addEnrolledDate').value = new Date().toISOString().split('T')[0];
  openModal('addStudentModal');
}

async function addStudent() {
  if (!canEditStudentInfo()) return;
  const first = document.getElementById('addFirst').value.trim();
  const last = document.getElementById('addLast').value.trim();
  const email = document.getElementById('addEmail').value.trim();
  const phone = document.getElementById('addPhone').value.trim();
  const courses = getSelectedCourseIds('addCourse');
  const course = courses[0] || '';
  const password = document.getElementById('addPassword').value;
  const studentId = document.getElementById('addStudentId').value.trim();
  const assignedFacultyId = isFaculty() ? adminUser.id : document.getElementById('addFacultyId').value.trim();
  const enrolledDate = document.getElementById('addEnrolledDate').value;
  const errEl = document.getElementById('addStudentErr');
  errEl.classList.add('hidden');

  if (!first || !last || !email || !course || !password) {
    errEl.textContent = 'Please fill all required fields.';
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
        courses,
        password,
        studentId,
        assignedFacultyId,
        enrolledDate,
        classDays: document.getElementById('addClassDays').value.trim(),
        classTime: document.getElementById('addClassTime').value.trim()
      })
    });

    closeModal('addStudentModal');
    await loadStudents();
    showToast('Student created', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

// ============================================================
// Notifications
// ============================================================
async function loadNotifications() {
  try {
    const data = await apiFetch('/api/notifications?t=' + Date.now());
    renderNotifTable(data.notifications);
  } catch (err) {
    console.error(err);
    showToast('Unable to load broadcasts', 'error');
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
  document.getElementById('notifImageUrl').value = '';
  document.getElementById('notifImageFile').value = '';
  document.getElementById('notifImageFileName').textContent = 'No image chosen';
  document.getElementById('notifImagePreview').style.display = 'none';


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
    ? '<option value="assigned">All Assigned Students</option><option value="individual">Assigned Individual Student</option>'
    : '<option value="all">All Students (Mass Notification)</option><option value="individual">Individual Student</option>';
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
    senderRole: adminRole,
    imageUrl: document.getElementById('notifImageUrl').value
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
    showToast(`Notification sent to ${target === 'all' ? 'all students' : target === 'assigned' ? 'assigned students' : 'student'}`, 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}


async function deleteNotif(id) {
  if (!confirm('Delete this broadcast?')) return;
  try {
    await apiDelete(`/api/notifications/${encodeURIComponent(id)}`);
    await loadNotifications();
    showToast('Broadcast deleted', 'info');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}


// ============================================================
// Payments
// ============================================================
function renderPayTable(students) {
  const tbody = document.getElementById('payTable');
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gray-400)">No students match the selected payment filters.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s => {
    const totalFee = getCourseTotalFee(s);
    const courseNames = getCourseNames(s);
    return `
      <tr>
        <td>
          <div style="font-weight:500">${escapeHtml(`${s.firstName || ''} ${s.lastName || ''}`.trim())}</div>
          <div style="font-size:0.8rem;color:var(--gray-400)">${escapeHtml(s.studentId || s.email || '')}</div>
        </td>
        <td>${escapeHtml(courseNames)}</td>
        <td>৳${totalFee.toLocaleString()}</td>
        <td style="color:var(--success);font-weight:500">৳${(s.totalPaid || 0).toLocaleString()}</td>
        <td style="color:${s.totalDue > 0 ? 'var(--danger)' : 'var(--gray-400)'};font-weight:500">৳${(s.totalDue || 0).toLocaleString()}</td>
        <td style="color:var(--gray-600);font-size:0.9rem">${s.nextPaymentDate ? formatDate(s.nextPaymentDate) : '—'}</td>
        <td>
          ${canManageStudents() ? `<button class="btn-xs btn-xs-pay" onclick="openPaymentModal('${escapeHtml(s.id)}')">Update Payment</button>` : '<span style="font-size:0.8rem;color:var(--gray-400)">View only</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function paymentDateValue(student) {
  if (!student.nextPaymentDate) return '';
  return String(student.nextPaymentDate).split('T')[0];
}

function filterPayments() {
  const q = document.getElementById('paySearch').value.toLowerCase();
  const sortBy = document.getElementById('paySort').value;
  const fromDate = document.getElementById('payDateFrom')?.value || '';
  const toDate = document.getElementById('payDateTo')?.value || '';

  let filtered = allStudents;
  if (q) {
    filtered = filtered.filter(s => `${s.firstName} ${s.lastName} ${s.email} ${s.studentId || ''}`.toLowerCase().includes(q));
  }
  if (fromDate || toDate) {
    filtered = filtered.filter(s => {
      const paymentDate = paymentDateValue(s);
      if (!paymentDate) return false;
      return (!fromDate || paymentDate >= fromDate) && (!toDate || paymentDate <= toDate);
    });
  }

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    }
    if (sortBy === 'due_desc') {
      return (b.totalDue || 0) - (a.totalDue || 0);
    }
    if (sortBy === 'date_asc') {
      if (!a.nextPaymentDate) return 1;
      if (!b.nextPaymentDate) return -1;
      return new Date(a.nextPaymentDate) - new Date(b.nextPaymentDate);
    }
    if (sortBy === 'date_desc') {
      if (!a.nextPaymentDate) return 1;
      if (!b.nextPaymentDate) return -1;
      return new Date(b.nextPaymentDate) - new Date(a.nextPaymentDate);
    }
    return 0;
  });

  renderPayTable(filtered);
}

function clearPaymentDateFilters() {
  const fromEl = document.getElementById('payDateFrom');
  const toEl = document.getElementById('payDateTo');
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  filterPayments();
}

function openPaymentModal(id) {
  if (!canManageStudents()) return;
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  const totalFee = getCourseTotalFee(s);
  const courseName = getCourseNames(s);

  document.getElementById('paymentStudentId').value = id;
  document.getElementById('paymentStudentName').textContent = `${s.firstName} ${s.lastName}`;
  document.getElementById('paymentStudentCourse').textContent = courseName;
  document.getElementById('paymentTotalFee').textContent = totalFee.toLocaleString();

  document.getElementById('paymentPaid').value = s.totalPaid || 0;
  document.getElementById('paymentDiscount').value = s.discount || 0;
  document.getElementById('paymentDue').value = s.totalDue || 0;
  document.getElementById('paymentNextDate').value = s.nextPaymentDate ? s.nextPaymentDate.split('T')[0] : '';
  document.getElementById('paymentErr').classList.add('hidden');

  recalculateDue();

  // Load installments
  loadInstallmentsEditor(id);

  openModal('paymentModal');
}

async function loadInstallmentsEditor(userId) {
  const container = document.getElementById('installmentContainer');
  const empty = document.getElementById('instEmpty');
  container.innerHTML = '';
  empty.style.display = 'block';

  try {
    const data = await apiFetch(`/api/installments?userId=${userId}`);
    if (data.installments && data.installments.length > 0) {
      empty.style.display = 'none';
      data.installments.forEach(inst => addInstallmentRow(inst));
    }
  } catch (e) {
    console.error('Failed to load installments:', e);
  }
}

function addInstallmentRow(data = {}) {
  const container = document.getElementById('installmentContainer');
  const empty = document.getElementById('instEmpty');
  empty.style.display = 'none';

  const row = document.createElement('div');
  row.className = 'installment-row';
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.alignItems = 'center';
  row.style.background = 'var(--gray-50)';
  row.style.padding = '8px';
  row.style.borderRadius = 'var(--radius-sm)';
  row.style.border = '1px solid var(--gray-100)';

  const dateValue = data.dueDate ? data.dueDate.split('T')[0] : '';
  const status = data.status || 'pending';

  row.innerHTML = `
    <input type="date" class="inst-date" value="${dateValue}" style="flex:1.2;padding:6px;font-size:0.85rem">
    <input type="number" class="inst-amount" value="${data.amount || ''}" placeholder="Amount" style="flex:1;padding:6px;font-size:0.85rem">
    <select class="inst-status" style="flex:1;padding:6px;font-size:0.85rem">
      <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
      <option value="paid" ${status === 'paid' ? 'selected' : ''}>Paid</option>
      <option value="overdue" ${status === 'overdue' ? 'selected' : ''}>Overdue</option>
    </select>
    <button type="button" class="btn-xs btn-xs-suspend" onclick="this.parentElement.remove(); checkInstEmpty()" style="padding:6px 10px">×</button>
  `;
  container.appendChild(row);
}

function checkInstEmpty() {
  const container = document.getElementById('installmentContainer');
  const empty = document.getElementById('instEmpty');
  if (container.children.length === 0) empty.style.display = 'block';
}

function recalculateDue() {
  const totalFee = parseFloat(document.getElementById('paymentTotalFee').textContent.replace(/,/g, '')) || 0;
  const paid = parseFloat(document.getElementById('paymentPaid').value) || 0;
  const discount = parseFloat(document.getElementById('paymentDiscount').value) || 0;

  const due = Math.max(0, totalFee - paid - discount);
  document.getElementById('paymentDue').value = due;
}

async function savePayment() {
  if (!canManageStudents()) return;
  const id = document.getElementById('paymentStudentId').value;
  const errEl = document.getElementById('paymentErr');
  try {
    const existing = allStudents.find(x => x.id === id);
    if (!existing) throw new Error("Student not found");

    const paid = parseFloat(document.getElementById('paymentPaid').value) || 0;
    const due = parseFloat(document.getElementById('paymentDue').value) || 0;
    const nextDate = document.getElementById('paymentNextDate').value || '';

    // Collect installments
    const installments = [];
    document.querySelectorAll('#installmentContainer .installment-row').forEach(row => {
      const dueDate = row.querySelector('.inst-date').value;
      const amount = parseFloat(row.querySelector('.inst-amount').value) || 0;
      const status = row.querySelector('.inst-status').value;
      if (dueDate && amount) {
        installments.push({ dueDate, amount, status });
      }
    });

    // Save student data
    await saveStudentPayload(id, {
      ...existing,
      totalPaid: paid,
      discount: parseFloat(document.getElementById('paymentDiscount').value) || 0,
      totalDue: due,
      nextPaymentDate: nextDate
    });

    // Save installments
    await apiFetch('/api/installments', {
      method: 'POST',
      body: JSON.stringify({ userId: id, installments })
    });

    closeModal('paymentModal');
    await loadStudents();
    showToast('Payment and Installment Plan updated', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}


// ============================================================
// Other Services
// ============================================================
async function loadServices() {
  try {
    const data = await apiFetch('/api/services?t=' + Date.now());
    renderServicesManageList(data.services);
  } catch (err) {
    console.error(err);
  }
}

function renderServicesManageList(services) {
  const container = document.getElementById('servicesManageList');
  if (!services || services.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--gray-400);grid-column:1/-1">No services added yet.</div>';
    return;
  }
  container.innerHTML = services.map(s => `
    <div class="card" style="display:flex; flex-direction:column; gap:12px; padding:16px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:1.5rem;">${s.icon.startsWith('http') ? `<img src="${s.icon}" style="width:32px;height:32px;object-fit:contain">` : s.icon}</div>
        <div style="flex:1">
          <div style="font-weight:600; color:var(--gray-800)">${s.name}</div>
          <div style="font-size:0.8rem; color:var(--gray-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px">${s.url}</div>
        </div>
      </div>
      <div style="font-size:0.85rem; color:var(--gray-600); line-height:1.4">${s.desc}</div>
      <div style="margin-top:auto; padding-top:12px; border-top:1px solid var(--gray-50); display:flex; justify-content:flex-end;">
        <button class="btn-xs btn-xs-suspend" onclick="deleteService('${s.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function openServiceModal() {
  document.getElementById('serviceName').value = '';
  document.getElementById('serviceDesc').value = '';
  document.getElementById('serviceUrl').value = '';
  document.getElementById('serviceIcon').value = '';
  document.getElementById('serviceErr').classList.add('hidden');
  openModal('serviceModal');
}

async function createService() {
  const name = document.getElementById('serviceName').value.trim();
  const desc = document.getElementById('serviceDesc').value.trim();
  const url = document.getElementById('serviceUrl').value.trim();
  const icon = document.getElementById('serviceIcon').value.trim();
  const errEl = document.getElementById('serviceErr');

  if (!name || !url) {
    errEl.textContent = 'Name and URL are required.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch('/api/services', {
      method: 'POST',
      body: JSON.stringify({ name, desc, url, icon })
    });
    closeModal('serviceModal');
    loadServices();
    showToast('Service added', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteService(id) {
  if (!confirm('Are you sure you want to delete this service?')) return;
  try {
    await apiDelete(`/api/services/${encodeURIComponent(id)}`);
    loadServices();
    showToast('Service deleted', 'info');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ============================================================
// Super Admin & Audit Logs
// ============================================================

function checkSuperAdmin() {
  if (adminUser && adminUser.isSuperAdmin) {
    document.getElementById('navSuperPortal').classList.remove('hidden');
    loadSuperUsers();
    loadAuditLogs();
  }
}

async function loadSuperUsers() {
  try {
    const data = await apiFetch('/api/admin/users');
    const tbody = document.getElementById('superUserList');
    tbody.innerHTML = data.users.map(u => {
      const userId = encodeURIComponent(u.id);
      const firstName = escapeHtml(u.firstName || '');
      const lastName = escapeHtml(u.lastName || '');
      const email = escapeHtml(u.email || '');
      const role = escapeHtml(u.role || 'student');
      return `
        <tr>
          <td style="font-weight:600">${firstName} ${lastName}</td>
          <td style="color:var(--gray-500)">${email}</td>
          <td><span class="badge badge-${role}">${role}</span></td>
          <td>
            <select onchange="updateUserRole('${userId}', this.value)" style="padding:4px 8px; border-radius:4px; border:1px solid var(--gray-200); font-size:0.85rem">
              <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
              <option value="faculty" ${u.role === 'faculty' ? 'selected' : ''}>Faculty</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>
            <div class="action-btns">
              <button class="btn-xs btn-xs-pay" onclick="openUserPasswordReset('${userId}', '${encodeURIComponent(u.email || '')}')">Reset Password</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

async function updateUserRole(userId, newRole) {
  if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
    loadSuperUsers();
    return;
  }
  try {
    await apiFetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole })
    });
    showToast('User role updated', 'success');
    loadSuperUsers();
    loadAuditLogs();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function loadAuditLogs() {
  try {
    const data = await apiFetch('/api/admin/logs');
    const tbody = document.getElementById('auditLogList');
    if (!data.logs || data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--gray-400)">No audit logs yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs.map(log => `
      <tr>
        <td style="font-size:0.8rem; color:var(--gray-500)">${formatAuditDate(log.created_at)}</td>
        <td style="font-weight:500">${log.admin_email || 'System'}</td>
        <td><code style="background:var(--gray-100); padding:2px 6px; border-radius:4px; font-size:0.75rem">${log.action || 'UNKNOWN'}</code></td>
        <td style="font-size:0.85rem">${log.details || '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
    const tbody = document.getElementById('auditLogList');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--red)">Unable to load audit logs: ${err.message}</td></tr>`;
    }
  }
}

function formatAuditDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function showSection(name, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = {
    'overview': 'Overview',
    'students': 'Students',
    'broadcasts': 'Broadcasts',
    'payments': 'Payments',
    'announcements': 'Announcements',
    'admin-calendar': 'Academic Calendar',
    'services': 'Other Services',
    'site-tools': 'Site Tools',
    'super-portal': 'User Management',
    'security': 'Security & Privacy',
    'attendance': 'Attendance'
  };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  if (name === 'attendance') loadAttendanceList();
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
    const data = await apiFetch('/api/announcements?t=' + Date.now());
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
  container.innerHTML = ads.map(ad => {
    const imgUrl = safeMediaUrl(ad.image_url || ad.imageUrl || '');
    const videoUrl = normalizeVideoEmbedUrl(ad.video_url || ad.videoUrl || '');
    const linkUrl = safeExternalUrl(ad.link_url || ad.linkUrl || '');
    const linkText = escapeHtml(ad.link_text || ad.linkText || 'Learn More');
    const bgGradient = safeAnnouncementBackground(ad.bg_gradient || ad.bgGradient || 'var(--primary)');
    const createdAt = ad.created_at || ad.createdAt;
    const title = escapeHtml(ad.title || 'Announcement');
    const body = escapeHtml(ad.body || '');
    const id = escapeHtml(ad.id || '');

    return `
    <div style="border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);border:0.5px solid rgba(148,163,184,0.28)">
      <div style="background:${bgGradient};padding:20px 24px;color:white;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
       ${videoUrl ? `<div style="width:220px;height:124px;border-radius:8px;flex-shrink:0;background:rgba(0,0,0,0.3);overflow:hidden"><iframe src="${videoUrl}" title="Announcement video preview" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:100%;border:0"></iframe></div>` :
        (imgUrl ? `<img src="${imgUrl}" onerror="this.style.display='none'" style="width:120px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0;background:rgba(0,0,0,0.15)" alt="${title}">` : `<div style="width:120px;height:80px;border-radius:8px;flex-shrink:0;background:rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:2rem"></div>`)}
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600;font-size:1.1rem;margin-bottom:6px">${title}</div>
          <div style="font-size:0.9rem;opacity:0.9;line-height:1.5">${body}</div>
          ${videoUrl ? `<div style="font-size:0.75rem;opacity:0.8;margin-top:4px;word-break:break-all">Embed: ${escapeHtml(videoUrl)}</div>` : ''}
          ${linkUrl ? `<div style="margin-top:10px"><span style="background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:6px;font-size:0.85rem">${linkText} →</span></div>` : ''}
        </div>
      </div>
      <div style="background:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.8rem;color:var(--gray-400)">Created: ${formatDate(createdAt)}</span>
        <div style="display:flex;gap:8px">
          <button class="btn-xs btn-xs-edit" onclick="openEditAnnouncement('${id}')">Edit</button>
          <button class="btn-xs btn-xs-suspend" onclick="deleteAd('${id}')">Delete</button>
        </div>
      </div>
    </div>
  `}).join('');
}


function safeAnnouncementBackground(value) {
  const background = String(value || '').trim();
  if (background === 'var(--primary)') return background;
  if (/^linear-gradient\([#%,.\s\w()-]+\)$/i.test(background)) return background;
  return 'var(--primary)';
}

function openAnnouncementModal() {
  const adId = document.getElementById('adId');
  if (adId) adId.value = '';
  const title = document.getElementById('adModalTitle');
  if (title) title.textContent = 'Create Announcement';
  const btn = document.getElementById('adSubmitBtn');
  if (btn) btn.textContent = 'Publish';

  document.getElementById('adTitle').value = '';
  document.getElementById('adBody').value = '';
  document.getElementById('adImageUrl').value = '';
  document.getElementById('adVideoUrl').value = '';
  document.getElementById('adLinkUrl').value = '';
  document.getElementById('adLinkText').value = 'Learn More';
  document.getElementById('adGradient').selectedIndex = 0;
  document.getElementById('adImageFile').value = '';
  document.getElementById('adImageFileName').textContent = 'No file chosen';
  document.getElementById('adImagePreview').style.display = 'none';
  document.getElementById('adErr').classList.add('hidden');
  openModal('announcementModal');
}



async function openEditAnnouncement(id) {
  try {
    const data = await apiFetch(`/api/announcements/${encodeURIComponent(id)}?t=` + Date.now());
    const ad = data.announcement;

    document.getElementById('adId').value = ad.id;
    document.getElementById('adModalTitle').textContent = 'Edit Announcement';
    document.getElementById('adSubmitBtn').textContent = 'Update';

    document.getElementById('adTitle').value = ad.title || '';
    document.getElementById('adBody').value = ad.body || '';
    document.getElementById('adImageUrl').value = ad.imageUrl || ad.image_url || '';
    document.getElementById('adVideoUrl').value = ad.videoUrl || ad.video_url || '';
    document.getElementById('adLinkUrl').value = ad.linkUrl || ad.link_url || '';
    document.getElementById('adLinkText').value = ad.linkText || ad.link_text || 'Learn More';

    const grad = ad.bgGradient || ad.bg_gradient || '';
    const sel = document.getElementById('adGradient');
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === grad) {
        sel.selectedIndex = i;
        break;
      }
    }

    if (ad.imageUrl || ad.image_url) {
      const preview = document.getElementById('adImagePreview');
      preview.style.display = 'block';
      preview.querySelector('img').src = safeMediaUrl(ad.imageUrl || ad.image_url);
    } else {
      document.getElementById('adImagePreview').style.display = 'none';
    }

    document.getElementById('adErr').classList.add('hidden');
    openModal('announcementModal');
  } catch (e) {
    showToast('Failed to load announcement: ' + e.message, 'error');
  }
}

async function createAnnouncement() {
  const adId = document.getElementById('adId').value;
  const title = document.getElementById('adTitle').value.trim();
  const body = document.getElementById('adBody').value.trim();
  const imageUrl = document.getElementById('adImageUrl').value.trim();
  const rawVideoUrl = document.getElementById('adVideoUrl').value.trim();
  const videoUrl = rawVideoUrl ? normalizeVideoEmbedUrl(rawVideoUrl) : '';
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

  if (rawVideoUrl && !videoUrl) {
    errEl.textContent = 'Paste a valid HTTPS iframe embed code or embed URL.';
    errEl.classList.remove('hidden');
    return;
  }

  const adData = { title, body, imageUrl, videoUrl, linkUrl, linkText, bgGradient };

  try {
    if (adId) {
      await apiFetch(`/api/announcements/${encodeURIComponent(adId)}`, {
        method: 'PATCH',
        body: JSON.stringify(adData)
      });
      showToast('Announcement updated', 'success');
    } else {
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify(adData)
      });
      showToast('Announcement published', 'success');
    }
    closeModal('announcementModal');
    await loadAnnouncements();
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteAd(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await apiDelete(`/api/announcements/${encodeURIComponent(id)}`);
    await loadAnnouncements();
    showToast('Announcement deleted', 'info');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ============================================================
// Site Tools — Cache Management
// ============================================================
async function clearAllCaches() {
  const statusEl = document.getElementById('cacheStatus');
  try {
    statusEl.textContent = 'Clearing caches...';
    statusEl.style.color = 'var(--gray-500)';

    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));

    statusEl.textContent = `Cleared ${keys.length} cache(s) successfully. Students will get fresh files on next visit.`;
    statusEl.style.color = 'var(--success)';
    showToast(`Cleared ${keys.length} cache(s)`, 'success');
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    statusEl.style.color = 'var(--danger)';
  }
}

async function forceFullReload() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    window.location.reload(true);
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ============================================================
// Maintenance Mode
// ============================================================
async function loadMaintenanceStatus() {
  try {
    const data = await apiFetch('/api/settings/maintenance');
    const toggle = document.getElementById('maintenanceToggle');
    const statusEl = document.getElementById('maintenanceStatus');
    if (toggle) {
      toggle.checked = data.enabled;
      updateToggleUI(data.enabled);
      statusEl.textContent = data.enabled ? 'Maintenance mode is ON — students see a maintenance page.' : 'Site is live — students can access the dashboard normally.';
      statusEl.style.color = data.enabled ? 'var(--danger)' : 'var(--success)';
    }

  } catch (e) {
    console.error('Maintenance status:', e);
  }
}

async function toggleMaintenanceMode(enabled) {
  const statusEl = document.getElementById('maintenanceStatus');
  try {
    statusEl.textContent = 'Updating...';
    statusEl.style.color = 'var(--gray-500)';
    await apiFetch('/api/settings/maintenance', {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
    statusEl.textContent = enabled ? 'Maintenance mode is ON — students see a maintenance page.' : 'Site is live — students can access the dashboard normally.';
    statusEl.style.color = enabled ? 'var(--danger)' : 'var(--success)';
    updateToggleUI(enabled);
    showToast(enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled', enabled ? 'error' : 'success');

  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    statusEl.style.color = 'var(--danger)';
    document.getElementById('maintenanceToggle').checked = !enabled;
    updateToggleUI(!enabled);
  }
}

function updateToggleUI(enabled) {
  const track = document.getElementById('maintenanceTrack');
  const slider = document.getElementById('maintenanceSlider');
  if (track && slider) {
    track.style.background = enabled ? 'var(--danger)' : 'var(--gray-300)';
    slider.style.left = enabled ? '30px' : '4px';
  }
}



// ============================================================
// Password Reset (Self-Service)
// ============================================================
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

// ============================================================
// Password Reset (Admin)
// ============================================================
function openResetPasswordModal(studentId) {
  if (!canManageStudents()) return;
  const s = allStudents.find(x => x.id === studentId);
  if (!s) return;
  document.getElementById('resetPwStudentId').value = studentId;
  document.getElementById('resetPwStudentName').textContent = `${s.firstName} ${s.lastName}`;
  document.getElementById('resetPwNew').value = '';
  document.getElementById('resetPwConfirm').value = '';
  document.getElementById('resetPwErr').classList.add('hidden');
  openModal('resetPasswordModal');
}

async function saveResetPassword() {
  const id = document.getElementById('resetPwStudentId').value;
  const newPw = document.getElementById('resetPwNew').value;
  const confirmPw = document.getElementById('resetPwConfirm').value;
  const errEl = document.getElementById('resetPwErr');

  if (!newPw || newPw.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.classList.remove('hidden');
    return;
  }
  if (newPw !== confirmPw) {
    errEl.textContent = 'Passwords do not match.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch(`/api/students/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword: newPw })
    });
    closeModal('resetPasswordModal');
    showToast('Password reset successfully', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

function openEditUserFromPayload(encodedPayload) {
  try {
    const user = JSON.parse(decodeURIComponent(encodedPayload));
    openEditUser(user.id, user.firstName, user.lastName, user.email);
  } catch (error) {
    showToast('Unable to open user editor: ' + error.message, 'error');
  }
}

function openUserPasswordReset(userId, email) {
  document.getElementById('resetUserId').value = decodeURIComponent(userId);
  document.getElementById('resetUserDisplayEmail').textContent = decodeURIComponent(email);
  document.getElementById('resetUserNewPw').value = '';
  document.getElementById('resetUserConfirmPw').value = '';
  document.getElementById('resetUserErr').classList.add('hidden');
  openModal('userPasswordResetModal');
}

async function saveUserPasswordReset() {
  const userId = document.getElementById('resetUserId').value;
  const newPass = document.getElementById('resetUserNewPw').value;
  const confirmPass = document.getElementById('resetUserConfirmPw').value;
  const errEl = document.getElementById('resetUserErr');
  errEl.classList.add('hidden');

  if (newPass.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.classList.remove('hidden');
    return;
  }
  if (newPass !== confirmPass) {
    errEl.textContent = 'Passwords do not match.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword: newPass })
    });
    showToast('User password reset successfully', 'success');
    closeModal('userPasswordResetModal');
    if (typeof loadAuditLogs === 'function' && adminUser.isSuperAdmin) loadAuditLogs();
  } catch (error) {
    errEl.textContent = 'Error: ' + error.message;
    errEl.classList.remove('hidden');
  }
}

function openEditUser(userId, fName, lName, email) {
  window.targetEditUserId = userId;
  document.getElementById('editUserDisplayEmail').textContent = email;
  document.getElementById('editFirstName').value = fName || '';
  document.getElementById('editLastName').value = lName || '';
  document.getElementById('editUserNewPw').value = '';
  document.getElementById('editUserConfirmPw').value = '';
  document.getElementById('editUserErr').classList.add('hidden');
  openModal('editUserModal');
}

async function saveUserChanges() {
  const fName = document.getElementById('editFirstName').value.trim();
  const lName = document.getElementById('editLastName').value.trim();
  const newPass = document.getElementById('editUserNewPw').value;
  const confirmPass = document.getElementById('editUserConfirmPw').value;
  const errEl = document.getElementById('editUserErr');
  errEl.classList.add('hidden');

  if (!fName || !lName) {
    errEl.textContent = 'First and Last name are required.';
    errEl.classList.remove('hidden');
    return;
  }

  if (newPass) {
    if (newPass.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.';
      errEl.classList.remove('hidden');
      return;
    }
    if (newPass !== confirmPass) {
      errEl.textContent = 'Passwords do not match.';
      errEl.classList.remove('hidden');
      return;
    }
  }

  try {
    const updateData = { firstName: fName, lastName: lName };
    if (newPass) updateData.password = newPass;

    await apiFetch(`/api/admin/users/${window.targetEditUserId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
    showToast('User updated successfully');
    closeModal('editUserModal');
    if (typeof loadStudents === 'function') loadStudents();
    if (typeof loadSuperUsers === 'function' && adminUser.isSuperAdmin) loadSuperUsers();
    if (typeof loadAuditLogs === 'function' && adminUser.isSuperAdmin) loadAuditLogs();
  } catch (error) {
    errEl.textContent = 'Error: ' + error.message;
    errEl.classList.remove('hidden');
  }
}


// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', function (e) {
    if (e.target === this) this.classList.add('hidden');
  });
});

// ============================================================
// Attendance Logic
// ============================================================
let currentAttendanceMap = {};
const attendanceStatuses = ['present', 'absent', 'late', 'excused'];
const attendanceStatusLabels = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused'
};

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function lockAttendanceDateToToday() {
  const dateInput = document.getElementById('attendanceDate');
  if (!dateInput) return '';
  const today = getTodayDateString();
  dateInput.value = today;
  dateInput.min = today;
  dateInput.max = today;
  dateInput.disabled = true;
  return today;
}

function initAttendance() {
  lockAttendanceDateToToday();
}

async function loadAttendanceList() {
  const dateEl = document.getElementById('attendanceDate');
  const courseEl = document.getElementById('attendanceCourseFilter');
  if (!dateEl || !courseEl) return;

  const date = lockAttendanceDateToToday() || dateEl.value;
  const courseId = courseEl.value;
  const list = document.getElementById('attendanceTable');
  const countLabel = document.getElementById('attendanceCountLabel');

  if (!date) {
    list.innerHTML = '<div class="attendance-empty">Select a date to continue.</div>';
    updateAttendanceSummary();
    return;
  }

  try {
    list.innerHTML = '<div class="attendance-empty">Loading students...</div>';

    const filteredStudents = allStudents.filter(s => {
      if (s.status !== 'active') return false;
      if (isFaculty() && s.assignedFacultyId !== adminUser.id) return false;
      if (courseId && !s.courses.includes(courseId)) return false;
      return true;
    });

    if (countLabel) countLabel.textContent = `${filteredStudents.length} students`;

    if (filteredStudents.length === 0) {
      list.innerHTML = '<div class="attendance-empty">No active students match this selection.</div>';
      updateAttendanceSummary();
      return;
    }

    const { attendance } = await apiFetch(`/api/attendance?date=${date}${courseId ? `&courseId=${courseId}` : ''}`);
    currentAttendanceMap = {};
    if (attendance) {
      attendance.forEach(a => {
        currentAttendanceMap[a.student_id] = a;
      });
    }

    list.innerHTML = filteredStudents.map(s => {
      const record = currentAttendanceMap[s.id] || { status: 'absent', notes: '' };
      return renderAttendanceRow(s, record);
    }).join('');
    updateAttendanceSummary();

  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="attendance-empty attendance-empty-error">${escapeHtml(err.message)}</div>`;
    updateAttendanceSummary();
  }
}

function renderAttendanceRow(student, record) {
  const safeStatus = attendanceStatuses.includes(record.status) ? record.status : 'absent';
  const studentName = escapeHtml(`${student.firstName || ''} ${student.lastName || ''}`.trim());
  const studentMeta = escapeHtml(student.studentId || student.email || '');
  const notes = escapeHtml(record.notes || '');
  const statusButtons = attendanceStatuses.map(status => `
    <button type="button" class="attendance-status-option ${status === safeStatus ? 'selected' : ''}" data-status="${status}" onclick="setAttendanceStatus('${student.id}', '${status}')">
      ${attendanceStatusLabels[status]}
    </button>
  `).join('');

  return `
    <div class="attendance-row" data-student-id="${student.id}" data-status="${safeStatus}">
      <div class="attendance-student-cell">
        <div class="attendance-student-name">${studentName}</div>
        <div class="attendance-student-meta">${studentMeta}</div>
      </div>
      <div class="attendance-status-cell" role="group" aria-label="Attendance status for ${studentName}">
        ${statusButtons}
      </div>
      <div class="attendance-notes-cell">
        <input type="text" class="notes-input" placeholder="Add note" value="${notes}" aria-label="Attendance note for ${studentName}">
      </div>
    </div>
  `;
}

function setAttendanceStatus(studentId, status) {
  if (!attendanceStatuses.includes(status)) return;
  const row = document.querySelector(`#attendanceTable [data-student-id="${studentId}"]`);
  if (!row) return;

  row.dataset.status = status;
  row.querySelectorAll('.attendance-status-option').forEach(button => {
    button.classList.toggle('selected', button.dataset.status === status);
  });
  updateAttendanceSummary();
}

function markAllAttendance(status) {
  if (!attendanceStatuses.includes(status)) return;
  document.querySelectorAll('#attendanceTable .attendance-row[data-student-id]').forEach(row => {
    setAttendanceStatus(row.dataset.studentId, status);
  });
}

function updateAttendanceSummary() {
  const summaryEl = document.getElementById('attendanceSelectionSummary');
  if (!summaryEl) return;

  const rows = Array.from(document.querySelectorAll('#attendanceTable .attendance-row[data-student-id]'));
  if (rows.length === 0) {
    summaryEl.textContent = 'No attendance loaded';
    return;
  }

  const totals = rows.reduce((acc, row) => {
    const status = row.dataset.status || 'absent';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  summaryEl.textContent = `Present ${totals.present || 0} · Absent ${totals.absent || 0} · Late ${totals.late || 0} · Excused ${totals.excused || 0}`;
}

async function submitAttendance() {
  const dateInput = document.getElementById('attendanceDate');
  const courseEl = document.getElementById('attendanceCourseFilter');
  if (!dateInput || !courseEl) return;

  const date = lockAttendanceDateToToday() || dateInput.value;
  const courseId = courseEl.value;
  const rows = document.querySelectorAll('#attendanceTable .attendance-row[data-student-id]');

  if (!date) {
    showToast('Please select a date first.', 'error');
    return;
  }

  if (rows.length === 0) {
    showToast('No students available for this selection.', 'error');
    return;
  }

  const records = Array.from(rows).map(row => ({
    studentId: row.dataset.studentId,
    date,
    courseId: courseId || '',
    status: row.dataset.status || 'absent',
    notes: row.querySelector('.notes-input').value
  }));

  try {
    showLoading(true);
    await apiFetch('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({ records })
    });
    showLoading(false);
    showToast('Attendance saved successfully', 'success');
  } catch (err) {
    showLoading(false);
    showToast(`Error: ${err.message}`, 'error');
  }
}
