const COURSES = {
  'ielts-academic': { totalFee: 15000 },
  'ielts-general': { totalFee: 13000 },
  'spoken-english': { totalFee: 8000 },
  'business-english': { totalFee: 10000 }
};

const SESSION_DAYS = 7;

export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

    if (method === 'OPTIONS') return json(null, 204);

    if (path[0] === 'auth' && path[1] === 'signup' && method === 'POST') return signup(context);
    if (path[0] === 'auth' && path[1] === 'login' && method === 'POST') return login(context);
    if (path[0] === 'auth' && path[1] === 'logout' && method === 'POST') return logout(context);
    if (path[0] === 'auth' && path[1] === 'me' && method === 'GET') return me(context);

    const user = await requireUser(context);

    if (path[0] === 'students' && method === 'GET') return listStudents(context, user);
    if (path[0] === 'students' && path[1] && method === 'PATCH') return updateStudent(context, user, path[1]);
    if (path[0] === 'students' && method === 'POST') return createStudent(context, user);

    if (path[0] === 'notifications' && method === 'GET') return listNotifications(context, user);
    if (path[0] === 'notifications' && method === 'POST') return createNotification(context, user);
    if (path[0] === 'notifications' && path[1] && method === 'DELETE') return deleteNotification(context, user, path[1]);

    if (path[0] === 'payments' && method === 'GET') return listPayments(context, user, url.searchParams.get('userId'));

    return error('Not found', 404);
  } catch (e) {
    return error(e.message || 'Server error', e.status || 500);
  }
}

async function signup({ request, env }) {
  const body = await readJson(request);
  const firstName = required(body.firstName, 'First name');
  const lastName = required(body.lastName, 'Last name');
  const email = normalizeEmail(required(body.email, 'Email'));
  const password = required(body.password, 'Password');
  const course = required(body.course, 'Course');

  if (password.length < 8) throw httpError('Password must be at least 8 characters.', 400);
  if (!COURSES[course]) throw httpError('Invalid course.', 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) throw httpError('An account with this email already exists.', 409);

  const salt = randomId();
  const passwordHash = await hashPassword(password, salt);
  const id = crypto.randomUUID();
  const finalStudentId = body.studentId ? String(body.studentId).trim() : `AIMS-${Math.floor(100000 + Math.random() * 900000)}`;

  await env.DB.prepare(`
    INSERT INTO users (id, first_name, last_name, email, phone, course, student_id, role, status, password_hash, password_salt, total_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'student', 'pending', ?, ?, ?)
  `).bind(
    id,
    firstName,
    lastName,
    email,
    body.phone || '',
    course,
    finalStudentId,
    passwordHash,
    salt,
    COURSES[course].totalFee
  ).run();

  return json({ ok: true });
}

async function login({ request, env }) {
  const body = await readJson(request);
  const email = normalizeEmail(required(body.email, 'Email'));
  const password = required(body.password, 'Password');
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

  if (!user || await hashPassword(password, user.password_salt) !== user.password_hash) {
    throw httpError('Invalid email or password.', 401);
  }
  if (user.status === 'pending') throw httpError('Your account is pending admin approval.', 403);
  if (user.status === 'suspended') throw httpError('Your account has been suspended. Contact AIMS admin.', 403);

  const sessionId = randomId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, expiresAt)
    .run();

  return json({ user: serializeUser(user) }, 200, sessionCookie(sessionId, expiresAt, request));
}

async function logout({ request, env }) {
  const sessionId = getCookie(request, 'aims_session');
  if (sessionId) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  return json({ ok: true }, 200, expiredSessionCookie());
}

async function me(context) {
  const user = await requireUser(context);
  return json({ user: serializeUser(user) });
}

async function listStudents({ env }, user) {
  requireRole(user, ['admin', 'faculty']);
  const stmt = user.role === 'faculty'
    ? env.DB.prepare("SELECT * FROM users WHERE role = 'student' AND assigned_faculty_id = ? ORDER BY created_at DESC").bind(user.id)
    : env.DB.prepare("SELECT * FROM users WHERE role = 'student' ORDER BY created_at DESC");
  const { results } = await stmt.all();
  return json({ students: results.map(serializeUser) });
}

async function createStudent({ request, env }, user) {
  requireRole(user, ['admin']);
  const body = await readJson(request);
  const firstName = required(body.firstName, 'First name');
  const lastName = required(body.lastName, 'Last name');
  const email = normalizeEmail(required(body.email, 'Email'));
  const password = required(body.password, 'Password');
  const course = required(body.course, 'Course');

  if (password.length < 8) throw httpError('Password must be at least 8 characters.', 400);
  if (!COURSES[course]) throw httpError('Invalid course.', 400);

  const salt = randomId();
  const passwordHash = await hashPassword(password, salt);
  const id = crypto.randomUUID();
  const finalStudentId = body.studentId ? String(body.studentId).trim() : `AIMS-${Math.floor(100000 + Math.random() * 900000)}`;

  await env.DB.prepare(`
    INSERT INTO users (id, first_name, last_name, email, phone, course, student_id, assigned_faculty_id, role, status, password_hash, password_salt, total_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student', 'active', ?, ?, ?)
  `).bind(
    id,
    firstName,
    lastName,
    email,
    body.phone || '',
    course,
    finalStudentId,
    body.assignedFacultyId || '',
    passwordHash,
    salt,
    COURSES[course].totalFee
  ).run();

  return json({ user: { id, firstName, lastName, email } }, 201);
}

async function updateStudent({ request, env }, user, studentId) {
  requireRole(user, ['admin']);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").bind(studentId).first();
  if (!existing) throw httpError('Student not found.', 404);

  const totalPaid = numberOrZero(body.totalPaid);
  const previousPaid = numberOrZero(existing.total_paid);

  await env.DB.prepare(`
    UPDATE users
    SET first_name = ?, last_name = ?, phone = ?, course = ?, status = ?, total_paid = ?, total_due = ?, student_id = ?, assigned_faculty_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND role = 'student'
  `).bind(
    required(body.firstName, 'First name'),
    required(body.lastName, 'Last name'),
    body.phone || '',
    required(body.course, 'Course'),
    required(body.status, 'Status'),
    totalPaid,
    numberOrZero(body.totalDue),
    body.studentId || '',
    body.assignedFacultyId || '',
    studentId
  ).run();

  const paymentDelta = totalPaid - previousPaid;
  if (paymentDelta > 0) {
    await env.DB.prepare('INSERT INTO payments (id, user_id, amount, description, status) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), studentId, paymentDelta, 'Admin update', 'Received')
      .run();
  }

  return json({ ok: true });
}

async function listNotifications({ env }, user) {
  if (user.role === 'admin') {
    const { results } = await env.DB.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
    return json({ notifications: results.map(serializeNotification) });
  }

  if (user.role === 'faculty') {
    const { results } = await env.DB.prepare('SELECT * FROM notifications WHERE sent_by = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
    return json({ notifications: results.map(serializeNotification) });
  }

  const { results } = await env.DB.prepare(`
    SELECT * FROM notifications
    WHERE target_type = 'all'
       OR (target_type = 'individual' AND target_user_id = ?)
       OR (target_type = 'assigned' AND target_faculty_id = ?)
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(user.id, user.assigned_faculty_id || '').all();
  return json({ notifications: results.map(serializeNotification) });
}

async function createNotification({ request, env }, user) {
  requireRole(user, ['admin', 'faculty']);
  const body = await readJson(request);
  const targetType = required(body.targetType, 'Target type');
  const title = required(body.title, 'Title');
  const message = required(body.body, 'Message');

  if (!['all', 'individual', 'assigned'].includes(targetType)) throw httpError('Invalid target type.', 400);
  if (user.role === 'faculty' && targetType === 'all') throw httpError('Faculty can only notify assigned students.', 403);

  let targetUserId = body.targetUserId || '';
  let targetFacultyId = body.targetFacultyId || '';

  if (targetType === 'assigned') {
    targetFacultyId = user.role === 'faculty' ? user.id : required(targetFacultyId, 'Target faculty');
  }

  if (targetType === 'individual') {
    const student = await env.DB.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").bind(required(targetUserId, 'Student')).first();
    if (!student) throw httpError('Student not found.', 404);
    if (user.role === 'faculty' && student.assigned_faculty_id !== user.id) {
      throw httpError('You can only notify students assigned to you.', 403);
    }
    if (user.role === 'faculty') targetFacultyId = user.id;
  }

  await env.DB.prepare(`
    INSERT INTO notifications (id, title, body, target_type, target_user_id, target_faculty_id, sent_by, sender_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), title, message, targetType, targetUserId, targetFacultyId, user.id, user.role).run();

  return json({ ok: true }, 201);
}

async function deleteNotification({ env }, user, notificationId) {
  const notification = await env.DB.prepare('SELECT * FROM notifications WHERE id = ?').bind(notificationId).first();
  if (!notification) throw httpError('Notification not found.', 404);
  if (user.role !== 'admin' && notification.sent_by !== user.id) throw httpError('Not allowed.', 403);
  await env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(notificationId).run();
  return json({ ok: true });
}

async function listPayments({ env }, user, requestedUserId) {
  const userId = requestedUserId || user.id;
  if (user.role === 'student' && userId !== user.id) throw httpError('Not allowed.', 403);
  if (user.role === 'faculty') {
    const student = await env.DB.prepare("SELECT assigned_faculty_id FROM users WHERE id = ? AND role = 'student'").bind(userId).first();
    if (!student || student.assigned_faculty_id !== user.id) throw httpError('Not allowed.', 403);
  }
  const { results } = await env.DB.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY date DESC').bind(userId).all();
  return json({ payments: results.map(serializePayment) });
}

async function requireUser({ request, env }) {
  const sessionId = getCookie(request, 'aims_session');
  if (!sessionId) throw httpError('Not authenticated.', 401);

  const row = await env.DB.prepare(`
    SELECT users.* FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).bind(sessionId).first();

  if (!row) throw httpError('Not authenticated.', 401);
  if (row.status !== 'active') throw httpError('Account is not active.', 403);
  return row;
}

function serializeUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone || '',
    course: row.course || '',
    studentId: row.student_id || '',
    assignedFacultyId: row.assigned_faculty_id || '',
    role: row.role,
    status: row.status,
    totalPaid: row.total_paid || 0,
    totalDue: row.total_due || 0,
    enrolledDate: row.enrolled_date,
    createdAt: row.created_at
  };
}

function serializeNotification(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    targetType: row.target_type,
    targetUserId: row.target_user_id || '',
    targetFacultyId: row.target_faculty_id || '',
    sentBy: row.sent_by,
    senderRole: row.sender_role,
    createdAt: row.created_at
  };
}

function serializePayment(row) {
  return {
    id: row.id,
    amount: row.amount || 0,
    description: row.description || 'Payment',
    status: row.status || 'Received',
    date: row.date
  };
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw httpError('Not allowed.', 403);
}

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') throw httpError(`${label} is required.`, 400);
  return String(value).trim();
}

function normalizeEmail(email) {
  return email.toLowerCase();
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.split('=')[1] || '';
}

function sessionCookie(sessionId, expiresAt, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `aims_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${new Date(expiresAt).toUTCString()}`;
}

function expiredSessionCookie() {
  return 'aims_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

function json(data, status = 200, cookie = null) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(data === null ? null : JSON.stringify(data), { status, headers });
}

function error(message, status = 500) {
  return json({ error: message }, status);
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}
