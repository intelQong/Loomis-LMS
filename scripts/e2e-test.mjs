import assert from 'node:assert/strict';

const BASE_URL = 'http://127.0.0.1:8788';

async function waitServerReady(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/index.html`);
      if (res.ok) return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Server not ready after retries');
}

async function runTests() {
  console.log('⏳ Waiting for Wrangler server to be ready on port 8788...');
  await waitServerReady();
  console.log('✅ Server is ready! Starting comprehensive verification tests.\n');

  let passed = 0;

  // 1. Static asset and HTML checks
  console.log('🔹 1. Testing static assets and HTML delivery...');
  for (const path of [
    '/index.html',
    '/student-dashboard.html',
    '/admin-dashboard.html',
    '/manifest.json',
    '/sw.js',
    '/js/app-data.js',
    '/js/api-client.js',
    '/js/auth.js',
    '/js/student-dashboard.js',
    '/js/admin-dashboard.js',
    '/styles/main.css',
    '/styles/auth.css',
    '/styles/dashboard.css',
    '/styles/admin.css'
  ]) {
    const res = await fetch(`${BASE_URL}${path}`);
    assert.equal(res.status, 200, `Failed to load ${path}`);
    passed++;
  }
  console.log(`   Passed ${passed} static asset checks.`);

  // 2. Auth Flow: Super Admin Signup & Login
  console.log('\n🔹 2. Testing Super Admin Signup and Auto-Promotion...');
  const adminEmail = `admin-${Date.now()}@test.com`;
  const adminPassword = 'Password123!';

  // Super admin configured in .dev.vars
  const configuredAdminEmail = 'admin@test.com';

  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({
      firstName: 'Super',
      lastName: 'Admin',
      email: configuredAdminEmail,
      password: adminPassword,
      course: 'ielts-regular'
    })
  });
  assert.equal(signupRes.status, 200, 'Super admin signup failed');
  passed++;

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({
      email: configuredAdminEmail,
      password: adminPassword
    })
  });
  assert.equal(loginRes.status, 200, 'Super admin login failed');
  const loginData = await loginRes.json();
  assert.equal(loginData.user.isSuperAdmin, true, 'User should be promoted to Super Admin');
  assert.equal(loginData.user.role, 'admin', 'Role must be admin');
  assert.equal(loginData.user.status, 'active', 'Status must be active');
  
  const rawCookie = loginRes.headers.get('set-cookie');
  assert.ok(rawCookie && rawCookie.includes('loomis_session='), 'Session cookie must be set');
  const sessionCookie = rawCookie.split(';')[0];
  passed++;
  console.log('   Super admin signed up, auto-promoted, and logged in.');

  // 3. Admin / Super Admin API endpoints
  console.log('\n🔹 3. Testing Administrative Endpoints...');
  const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: sessionCookie, 'Origin': BASE_URL }
  });
  assert.equal(usersRes.status, 200, 'Failed to fetch admin users');
  const usersData = await usersRes.json();
  assert.ok(Array.isArray(usersData.users), 'Users should be an array');
  passed++;

  // 4. Student registration, pending gate, and approval
  console.log('\n🔹 4. Testing Student Lifecycle (Signup -> Pending Gate -> Approval -> Login)...');
  const studentEmail = `student-${Date.now()}@example.com`;
  const studentPassword = 'StudentPassword123!';

  const studentSignupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({
      firstName: 'Rahim',
      lastName: 'Uddin',
      email: studentEmail,
      password: studentPassword,
      course: 'ielts-regular',
      phone: '+8801700000000'
    })
  });
  assert.equal(studentSignupRes.status, 200, 'Student signup failed');
  passed++;

  // Attempt login before approval (must be rejected)
  const pendingLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email: studentEmail, password: studentPassword })
  });
  assert.equal(pendingLoginRes.status, 403, 'Pending student must not be allowed to log in');
  passed++;

  // Admin approves student
  const studentsListRes = await fetch(`${BASE_URL}/api/students`, {
    headers: { Cookie: sessionCookie, 'Origin': BASE_URL }
  });
  assert.equal(studentsListRes.status, 200, 'Admin student list failed');
  const studentsListData = await studentsListRes.json();
  const createdStudent = studentsListData.students.find(s => s.email === studentEmail);
  assert.ok(createdStudent, 'Created student must appear in admin list');

  const approveRes = await fetch(`${BASE_URL}/api/students/${createdStudent.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie, 'Origin': BASE_URL },
    body: JSON.stringify({
      firstName: createdStudent.firstName,
      lastName: createdStudent.lastName,
      course: createdStudent.course,
      courses: [createdStudent.course],
      status: 'active',
      totalPaid: 2000,
      totalDue: 5000,
      discount: 0
    })
  });
  assert.equal(approveRes.status, 200, 'Student approval failed');
  passed++;

  // Student logs in after approval
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email: studentEmail, password: studentPassword })
  });
  assert.equal(studentLoginRes.status, 200, 'Student login after approval failed');
  const studentCookie = studentLoginRes.headers.get('set-cookie').split(';')[0];
  passed++;
  console.log('   Student registration, approval gate, and authentication verified.');

  // 5. Announcements, Attendance & Broadcasts
  console.log('\n🔹 5. Testing Announcements, Attendance, and Broadcasts...');
  const today = new Date().toISOString().split('T')[0];

  // Admin creates announcement
  const adRes = await fetch(`${BASE_URL}/api/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie, 'Origin': BASE_URL },
    body: JSON.stringify({
      title: 'Special Mock Test Week',
      body: 'All students are invited to the CD mock test hall.',
      linkText: 'Register Now',
      linkUrl: 'https://example.com/register'
    })
  });
  assert.equal(adRes.status, 200, 'Create announcement failed');
  passed++;

  // Student reads announcements
  const studentAdRes = await fetch(`${BASE_URL}/api/announcements`, {
    headers: { Cookie: studentCookie, 'Origin': BASE_URL }
  });
  assert.equal(studentAdRes.status, 200);
  const studentAdData = await studentAdRes.json();
  assert.ok(studentAdData.announcements.some(a => a.title === 'Special Mock Test Week'));
  passed++;

  // Admin logs attendance
  const attendRes = await fetch(`${BASE_URL}/api/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie, 'Origin': BASE_URL },
    body: JSON.stringify({
      records: [{
        studentId: createdStudent.id,
        date: today,
        courseId: 'ielts-regular',
        status: 'present',
        notes: 'Great participation'
      }]
    })
  });
  assert.equal(attendRes.status, 200, 'Log attendance failed');
  passed++;

  // Student checks attendance
  const studentAttendRes = await fetch(`${BASE_URL}/api/attendance`, {
    headers: { Cookie: studentCookie, 'Origin': BASE_URL }
  });
  assert.equal(studentAttendRes.status, 200);
  const studentAttendData = await studentAttendRes.json();
  assert.ok(studentAttendData.attendance.length > 0, 'Student should see attendance record');
  assert.equal(studentAttendData.attendance[0].status, 'present');
  passed++;

  // Admin sends notification broadcast
  const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie, 'Origin': BASE_URL },
    body: JSON.stringify({
      title: 'Class Schedule Notice',
      body: 'Friday class timings are adjusted.',
      targetType: 'all'
    })
  });
  assert.equal(notifRes.status, 201, 'Send broadcast notification failed');
  passed++;

  // Student receives notification
  const studentNotifRes = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { Cookie: studentCookie, 'Origin': BASE_URL }
  });
  assert.equal(studentNotifRes.status, 200);
  const studentNotifData = await studentNotifRes.json();
  assert.ok(studentNotifData.notifications.some(n => n.title === 'Class Schedule Notice'));
  passed++;

  // 6. Password Change & Session Invalidation
  console.log('\n🔹 6. Testing Password Change & Logout...');
  const newStudentPassword = 'NewStudentPass123!';
  const pwChangeRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentCookie, 'Origin': BASE_URL },
    body: JSON.stringify({
      currentPassword: studentPassword,
      newPassword: newStudentPassword
    })
  });
  assert.equal(pwChangeRes.status, 200, 'Password change failed');
  passed++;

  // Old password fails
  const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email: studentEmail, password: studentPassword })
  });
  assert.equal(oldLoginRes.status, 401, 'Old password must be rejected');
  passed++;

  // New password succeeds
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
    body: JSON.stringify({ email: studentEmail, password: newStudentPassword })
  });
  assert.equal(newLoginRes.status, 200, 'New password login failed');
  passed++;

  // Logout
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentCookie, 'Origin': BASE_URL }
  });
  assert.equal(logoutRes.status, 200, 'Logout failed');
  passed++;

  console.log(`\n🎉 ALL ${passed} VERIFICATION CHECKS PASSED WITH 100% SUCCESS!`);
}

runTests().catch(err => {
  console.error('\n❌ Verification test failure:', err);
  process.exit(1);
});
