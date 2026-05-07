// ============================================================
// AIMS LMS — Admin Dashboard Logic
// ============================================================

let allStudents = [];
let adminUser = null;
let adminRole = 'admin';

// Auth guard — admins and active faculty can use this dashboard.
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  const data = await getCurrentUserData();
  if (!data || !['admin', 'faculty'].includes(data.role)) {
    if (data && data.role === 'student') window.location.href = 'student-dashboard.html';
    else { await auth.signOut(); window.location.href = 'index.html'; }
    return;
  }
  if (data.role === 'faculty' && data.status !== 'active') {
    await auth.signOut();
    window.location.href = 'index.html';
    return;
  }
  adminUser = data;
  adminRole = data.role;
  document.getElementById('sidebarName').textContent = `${data.firstName} ${data.lastName}`;
  document.getElementById('sidebarAvatar').textContent = data.firstName[0].toUpperCase();
  configureDashboardForRole();
  initAdmin();
});

function initAdmin() {
  loadStudents();
  loadNotifications();
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
function loadStudents() {
  let query = db.collection('users').where('role', '==', 'student');
  if (isFaculty()) {
    query = query.where('assignedFacultyId', '==', adminUser.id);
  }

  query.orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderOverviewStats();
      renderPendingList();
      renderStudentsTable(allStudents);
      renderPayTable(allStudents);
      populateNotifStudentSelect(allStudents);
    }, err => console.error(err));
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
  await db.collection('users').doc(id).update({ status: 'active' });
  showToast('Student approved ✓', 'success');
}

async function suspendStudent(id) {
  if (!canManageStudents()) return;
  if (!confirm('Suspend/reject this student?')) return;
  await db.collection('users').doc(id).update({ status: 'suspended' });
  showToast('Student suspended', 'info');
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

    await db.collection('users').doc(id).update({
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

    // Log payment entry if paid > 0
    if (paid > 0) {
      await db.collection('users').doc(id)
        .collection('payments')
        .add({
          amount: paid,
          description: 'Admin update',
          status: 'Received',
          date: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    closeModal('editStudentModal');
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
    // Create auth user (Note: this signs in as the new user temporarily)
    // In production, use Firebase Admin SDK / Cloud Function for this
    // For now we use client-side create and re-sign in admin
    const adminEmail = adminUser.email;
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      firstName: first, lastName: last, email, phone,
      course, studentId, assignedFacultyId, role: 'student', status: 'active',
      totalPaid: 0, totalDue: COURSES[course] ? COURSES[course].totalFee : 0,
      enrolledDate: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Note: Admin will need to re-login. Show warning.
    closeModal('addStudentModal');
    showToast('Student created! You may need to re-login.', 'info');
    setTimeout(() => {
      if (confirm('Adding student signed you out. Re-login as admin?')) {
        window.location.href = 'index.html';
      }
    }, 1500);
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

// ============================================================
// Notifications
// ============================================================
function loadNotifications() {
  let query = db.collection('notifications');
  if (isFaculty()) {
    query = query.where('sentBy', '==', adminUser.id);
  }

  query.orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(snap => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderNotifTable(notifs);
    });
}

function renderNotifTable(notifs) {
  const tbody = document.getElementById('notifTable');
  if (notifs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--gray-400)">No notifications sent yet.</td></tr>';
    return;
  }
  tbody.innerHTML = notifs.map(n => {
    const date = n.createdAt ? n.createdAt.toDate().toLocaleDateString('en-GB') : '—';
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
    senderRole: adminRole,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
    await db.collection('notifications').add(notifData);
    closeModal('notifModal');
    showToast(`Notification sent to ${target === 'all' ? 'all students' : target === 'assigned' ? 'assigned students' : 'student'} ✓`, 'success');
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteNotif(id) {
  const notif = await db.collection('notifications').doc(id).get();
  if (isFaculty() && (!notif.exists || notif.data().sentBy !== adminUser.id)) return;
  if (!confirm('Delete this notification?')) return;
  await db.collection('notifications').doc(id).delete();
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

async function handleLogout() {
  await auth.signOut();
  window.location.href = 'index.html';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});
