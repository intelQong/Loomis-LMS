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
  loadServices();
  loadMaintenanceStatus();
  loadCalendar();
  renderGreeting();
  startLiveClock();
  checkSuperAdmin();
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
  document.getElementById('dueCollectionCard').classList.toggle('hidden', isFaculty());
  document.getElementById('pendingQuickView').classList.toggle('hidden', isFaculty());
  document.getElementById('studentsSectionTitle').textContent = isFaculty() ? 'Assigned Students' : 'Students';
  document.getElementById('notificationsSectionTitle').textContent = isFaculty() ? 'Send Broadcast' : 'Broadcasts';
}

function handleFileSelect(input, urlId, previewId) {
  const file = input.files[0];
  if (!file) return;

  const fileNameSpan = document.getElementById(input.id + 'Name');
  if (fileNameSpan) fileNameSpan.textContent = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
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
    showToast('Calendar entry added ✓', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteCalendarEntry(id) {
  if (!confirm('Delete this calendar entry?')) return;
  try {
    await apiFetch(`/api/calendar/${id}`, { method: 'DELETE' });
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
    renderPayTable(allStudents);
    populateNotifStudentSelect(allStudents);
  } catch (err) {
    console.error(err);
    showToast('Unable to load students', 'error');
  }
}

function renderOverviewStats() {
  const period = document.getElementById('statPeriod') ? document.getElementById('statPeriod').value : 'month';
  const now = new Date();
  
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
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

function renderPendingList() {
  const pending = allStudents.filter(s => s.status === 'pending');
  const container = document.getElementById('pendingList');
  if (pending.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray-400);grid-column: 1/-1;">No pending approvals 🎉</div>';
    return;
  }
  container.innerHTML = pending.map(s => {
    const course = COURSES[s.course];
    return `
      <div class="pending-item" style="border: 1px solid var(--gray-100); padding: 12px; border-radius: 10px; background: var(--gray-50); display: flex; flex-direction: column; gap: 8px;">
        <div class="pending-info" style="margin:0">
          <div class="pending-name" style="font-size: 0.95rem; font-weight: 600;">${s.firstName} ${s.lastName}</div>
          <div class="pending-meta" style="font-size: 0.8rem; line-height: 1.4;">
            ${course ? course.name : s.course}<br>
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
    const course = COURSES[s.course];
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
        <td>${course ? course.name : s.course || '—'}</td>
        <td><span class="badge ${statusClass}">${s.status || 'pending'}</span></td>
        <td>${s.enrolledDate ? formatDate(s.enrolledDate) : '—'}</td>
        <td style="font-weight:500;color:var(--teal)">${expiryStr}</td>
        <td>
          <div class="action-btns">
            ${canManageStudents() && s.status === 'pending' ? `<button class="btn-xs btn-xs-approve" onclick="approveStudent('${s.id}')">Approve</button>` : ''}
            ${canManageStudents() ? `<button class="btn-xs btn-xs-edit" onclick="openEditStudent('${s.id}')">Edit</button>` : ''}
            ${canManageStudents() ? `<button class="btn-xs" style="background:var(--gray-100);color:var(--gray-700)" onclick="openResetPasswordModal('${s.id}')">🔑</button>` : ''}
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
  try {
    await saveStudentPayload(id, { ...student, status: 'active' });
    await loadStudents();
    showToast('Student approved ✓', 'success');
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
  if (!canManageStudents()) return;
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  document.getElementById('editStudentId').value = id;
  document.getElementById('editFirst').value = s.firstName || '';
  document.getElementById('editLast').value = s.lastName || '';
  document.getElementById('editPhone').value = s.phone || '';
  document.getElementById('editCourse').value = s.course || '';
  document.getElementById('editStatus').value = s.status || 'pending';
  document.getElementById('editStudentIdField').value = s.studentId || '';
  document.getElementById('editFacultyId').value = s.assignedFacultyId || '';
  document.getElementById('editEnrolledDate').value = s.enrolledDate ? s.enrolledDate.split('T')[0] : '';
  document.getElementById('editClassDays').value = s.classDays || '';
  document.getElementById('editClassTime').value = s.classTime || '';
  document.getElementById('editStudentErr').classList.add('hidden');
  openModal('editStudentModal');
}

async function saveStudentEdit() {
  if (!canManageStudents()) return;
  const id = document.getElementById('editStudentId').value;
  const errEl = document.getElementById('editStudentErr');
  try {
    const course = document.getElementById('editCourse').value;
    const existing = allStudents.find(x => x.id === id);
    const paid = existing ? (existing.totalPaid || 0) : 0;
    const due = existing ? (existing.totalDue || 0) : 0;

    await saveStudentPayload(id, {
      firstName: document.getElementById('editFirst').value.trim(),
      lastName: document.getElementById('editLast').value.trim(),
      phone: document.getElementById('editPhone').value.trim(),
      course,
      status: document.getElementById('editStatus').value,
      totalPaid: paid,
      totalDue: due,
      studentId: document.getElementById('editStudentIdField').value.trim(),
      assignedFacultyId: document.getElementById('editFacultyId').value.trim(),
      enrolledDate: document.getElementById('editEnrolledDate').value,
      classDays: document.getElementById('editClassDays').value.trim(),
      classTime: document.getElementById('editClassTime').value.trim()
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
  ['addFirst','addLast','addEmail','addPhone','addPassword','addStudentId','addFacultyId','addEnrolledDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Default selections
  document.getElementById('addClassDays').value = 'Sat, Mon, Wed';
  document.getElementById('addClassTime').value = '4:00 PM';
  // Default to today
  document.getElementById('addEnrolledDate').value = new Date().toISOString().split('T')[0];
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
    showToast(`Notification sent to ${target === 'all' ? 'all students' : target === 'assigned' ? 'assigned students' : 'student'} ✓`, 'success');
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}


async function deleteNotif(id) {
  if (!confirm('Delete this broadcast?')) return;
  await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
  await loadNotifications();
  showToast('Broadcast deleted', 'info');
}


// ============================================================
// Payments
// ============================================================
function renderPayTable(students) {
  const tbody = document.getElementById('payTable');
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gray-400)">No students.</td></tr>';
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
        <td style="color:var(--gray-600);font-size:0.9rem">${s.nextPaymentDate ? formatDate(s.nextPaymentDate) : '—'}</td>
        <td>
          ${canManageStudents() ? `<button class="btn-xs btn-xs-pay" onclick="openPaymentModal('${s.id}')">Update Payment</button>` : '<span style="font-size:0.8rem;color:var(--gray-400)">View only</span>'}
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

function openPaymentModal(id) {
  if (!canManageStudents()) return;
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  
  const course = COURSES[s.course];
  const totalFee = course ? course.totalFee : 0;
  const courseName = course ? course.name : s.course || '—';
  
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
    <button type="button" class="btn-xs btn-xs-suspend" onclick="this.parentElement.remove(); checkInstEmpty()" style="padding:6px 10px">✕</button>
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
    showToast('Payment and Installment Plan updated ✓', 'success');
  } catch(e) {
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
  document.getElementById('serviceIcon').value = '🌐';
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
    showToast('Service added ✓', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteService(id) {
  if (!confirm('Are you sure you want to delete this service?')) return;
  try {
    await apiFetch(`/api/services/${id}`, { method: 'DELETE' });
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
    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td style="font-weight:600">${u.firstName} ${u.lastName}</td>
        <td style="color:var(--gray-500)">${u.email}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td>
          <select onchange="updateUserRole('${u.id}', this.value)" style="padding:4px 8px; border-radius:4px; border:1px solid var(--gray-200); font-size:0.85rem">
            <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
            <option value="faculty" ${u.role === 'faculty' ? 'selected' : ''}>Faculty</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
      </tr>
    `).join('');
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
    showToast('User role updated ✓', 'success');
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
    tbody.innerHTML = data.logs.map(log => `
      <tr>
        <td style="font-size:0.8rem; color:var(--gray-500)">${new Date(log.created_at).toLocaleString()}</td>
        <td style="font-weight:500">${log.admin_email}</td>
        <td><code style="background:var(--gray-100); padding:2px 6px; border-radius:4px; font-size:0.75rem">${log.action}</code></td>
        <td style="font-size:0.85rem">${log.details}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
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
    const imgUrl = ad.image_url || ad.imageUrl || '';
    const videoUrl = ad.video_url || ad.videoUrl || '';
    const linkUrl = ad.link_url || ad.linkUrl;
    const linkText = ad.link_text || ad.linkText || 'Learn More';
    const bgGradient = ad.bg_gradient || ad.bgGradient || 'var(--primary)';
    const createdAt = ad.created_at || ad.createdAt;
    
    return `
    <div style="border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)">
      <div style="background:${bgGradient};padding:20px 24px;color:white;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
       ${videoUrl ? `<div style="width:120px;height:80px;border-radius:8px;flex-shrink:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem">🎥</div>` : 
         (imgUrl ? `<img src="${imgUrl}" onerror="this.style.display='none'" style="width:120px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0;background:rgba(0,0,0,0.15)" alt="${ad.title}">` : `<div style="width:120px;height:80px;border-radius:8px;flex-shrink:0;background:rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:2rem">📢</div>`)}
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600;font-size:1.1rem;margin-bottom:6px">${ad.title}</div>
          <div style="font-size:0.9rem;opacity:0.9;line-height:1.5">${ad.body || ''}</div>
          ${videoUrl ? `<div style="font-size:0.75rem;opacity:0.8;margin-top:4px;word-break:break-all">Video: ${videoUrl}</div>` : ''}
          ${linkUrl ? `<div style="margin-top:10px"><span style="background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:6px;font-size:0.85rem">${linkText} →</span></div>` : ''}
        </div>
      </div>
      <div style="background:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.8rem;color:var(--gray-400)">Created: ${formatDate(createdAt)}</span>
        <button class="btn-xs btn-xs-suspend" onclick="deleteAd('${ad.id}')">Delete</button>
      </div>
    </div>
  `}).join('');
}

function openAnnouncementModal() {
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



async function createAnnouncement() {
  const title = document.getElementById('adTitle').value.trim();
  const body = document.getElementById('adBody').value.trim();
  const imageUrl = document.getElementById('adImageUrl').value.trim();
  const videoUrl = document.getElementById('adVideoUrl').value.trim();
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

  // Basic Video URL validation to prevent recursive site embedding
  if (videoUrl && videoUrl.includes(window.location.hostname)) {
    errEl.textContent = 'Cannot use internal site links as Video URLs. Please use a YouTube or Vimeo link.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiFetch('/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, body, imageUrl, videoUrl, linkUrl, linkText, bgGradient })
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

    statusEl.textContent = `✅ Cleared ${keys.length} cache(s) successfully. Students will get fresh files on next visit.`;
    statusEl.style.color = 'var(--success)';
    showToast(`Cleared ${keys.length} cache(s)`, 'success');
  } catch (e) {
    statusEl.textContent = '❌ Error: ' + e.message;
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
      statusEl.textContent = data.enabled ? '🔴 Maintenance mode is ON — students see a maintenance page.' : '🟢 Site is live — students can access the dashboard normally.';
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
    statusEl.textContent = enabled ? '🔴 Maintenance mode is ON — students see a maintenance page.' : '🟢 Site is live — students can access the dashboard normally.';
    statusEl.style.color = enabled ? 'var(--danger)' : 'var(--success)';
    updateToggleUI(enabled);
    showToast(enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled', enabled ? 'error' : 'success');

  } catch (e) {
    statusEl.textContent = '❌ Error: ' + e.message;
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

  if (!newPw || newPw.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
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
    showToast('Password reset successfully ✓', 'success');
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}


// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});
