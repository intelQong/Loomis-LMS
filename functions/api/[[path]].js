const COURSES = {
  'ielts-regular': { totalFee: 7000 },
  'ielts-fast-track': { totalFee: 7000 },
  'ielts-platinum': { totalFee: 15000 },
  'ielts-online': { totalFee: 3000 },
  'ielts-skill-focus': { totalFee: 2500 },
  'executive-ielts': { totalFee: 7000 },
  'pte-academic': { totalFee: 8000 },
  'spoken-english': { totalFee: 4500 },
  'business-english': { totalFee: 6000 },
  'spoken-english-online': { totalFee: 2000 },
  'foundation-english': { totalFee: 2500 }
};

const SESSION_DAYS = 1;
const SUPER_ADMIN_EMAIL = 'admin@example.com';

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
    if (path[0] === 'students' && path[1] && path[2] === 'reset-password' && method === 'POST') return resetStudentPassword(context, user, path[1]);
    if (path[0] === 'students' && path[1] && method === 'PATCH') return updateStudent(context, user, path[1]);
    if (path[0] === 'students' && method === 'POST') return createStudent(context, user);

    if (path[0] === 'notifications' && method === 'GET') return listNotifications(context, user);
    if (path[0] === 'notifications' && method === 'POST') return createNotification(context, user);
    if (path[0] === 'notifications' && path[1] && method === 'DELETE') return deleteNotification(context, user, path[1]);

    if (path[0] === 'payments' && method === 'GET') return listPayments(context, user, url.searchParams.get('userId'));

    if (path[0] === 'announcements' && method === 'GET') return listAnnouncements(context);
    if (path[0] === 'announcements' && method === 'POST') return createAnnouncement(context, user);
    if (path[0] === 'announcements' && path[1] && method === 'DELETE') return deleteAnnouncement(context, user, path[1]);

    if (path[0] === 'settings' && path[1] === 'maintenance' && method === 'GET') return getMaintenanceMode(context);
    if (path[0] === 'settings' && path[1] === 'maintenance' && method === 'PUT') return setMaintenanceMode(context, user);

    if (path[0] === 'installments' && method === 'GET') return listInstallments(context, user, url.searchParams.get('userId'));
    if (path[0] === 'installments' && method === 'POST') return saveInstallments(context, user);

    if (path[0] === 'services' && method === 'GET') return listServices(context);
    if (path[0] === 'services' && method === 'POST') return createService(context, user);
    if (path[0] === 'services' && path[1] && method === 'DELETE') return deleteService(context, user, path[1]);

    if (path[0] === 'admin' && path[1] === 'users' && method === 'GET') return listAllUsers(context, user);
    if (path[0] === 'admin' && path[1] === 'users' && path[2] && method === 'PATCH') return updateUserRole(context, user, path[2]);
    if (path[0] === 'admin' && path[1] === 'logs' && method === 'GET') return listAuditLogs(context, user);

    if (path[0] === 'calendar' && method === 'GET') return listCalendar(context);
    if (path[0] === 'calendar' && method === 'POST') return createCalendarEntry(context, user);
    if (path[0] === 'calendar' && path[1] && method === 'DELETE') return deleteCalendarEntry(context, user, path[1]);


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

  if (!user) throw httpError('No account found with this email. Please sign up first.', 401);
  if (await hashPassword(password, user.password_salt) !== user.password_hash) {
    throw httpError('Invalid password. Please try again.', 401);
  }
  if (user.status === 'pending' && email !== SUPER_ADMIN_EMAIL) throw httpError('Your account is pending admin approval.', 403);
  if (user.status === 'suspended') throw httpError('Your account has been suspended. Contact AIMS admin.', 403);

  // Super Admin Promotion
  if (email === SUPER_ADMIN_EMAIL && (user.role !== 'admin' || user.status !== 'active')) {
    await env.DB.prepare("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?").bind(user.id).run();
    user.role = 'admin';
    user.status = 'active';
  }

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

async function listStudents(context, user) {
  const { env } = context;
  requireRole(user, ['admin', 'faculty']);
  await ensureUserCompatibilityColumns(env);
  const stmt = user.role === 'faculty'
    ? env.DB.prepare("SELECT * FROM users WHERE role = 'student' AND assigned_faculty_id = ? ORDER BY created_at DESC").bind(user.id)
    : env.DB.prepare("SELECT * FROM users WHERE role = 'student' ORDER BY created_at DESC");
  const { results } = await stmt.all();
  return json({ students: results.map(serializeUser) });
}

async function createStudent({ request, env }, user) {
  requireRole(user, ['admin']);
  await ensureUserCompatibilityColumns(env);
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
    INSERT INTO users (id, first_name, last_name, email, phone, course, student_id, assigned_faculty_id, role, status, password_hash, password_salt, total_due, enrolled_date, class_days, class_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student', 'active', ?, ?, ?, ?, ?, ?)
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
    COURSES[course].totalFee,
    body.enrolledDate || new Date().toISOString(),
    body.classDays || '',
    body.classTime || ''
  ).run();

  await logAction(env, user, 'CREATE_STUDENT', `Created student ${email}`, id);

  return json({ user: { id, firstName, lastName, email } }, 201);
}

async function updateStudent({ request, env }, user, studentId) {
  requireRole(user, ['admin']);
  await ensureUserCompatibilityColumns(env);
  const body = await readJson(request);
  const existing = await env.DB.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").bind(studentId).first();
  if (!existing) throw httpError('Student not found.', 404);

  const totalPaid = numberOrZero(body.totalPaid);
  const previousPaid = numberOrZero(existing.total_paid);

  try {
    await env.DB.prepare(`
      UPDATE users
      SET first_name = ?, last_name = ?, phone = ?, course = ?, status = ?, total_paid = ?, total_due = ?, discount = ?, student_id = ?, assigned_faculty_id = ?, next_payment_date = ?, enrolled_date = ?, class_days = ?, class_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND role = 'student'
    `).bind(
      required(body.firstName, 'First name'),
      required(body.lastName, 'Last name'),
      body.phone || '',
      required(body.course, 'Course'),
      required(body.status, 'Status'),
      totalPaid,
      numberOrZero(body.totalDue),
      numberOrZero(body.discount),
      body.studentId || '',
      body.assignedFacultyId || '',
      body.nextPaymentDate || '',
      body.enrolledDate || existing.enrolled_date,
      body.classDays || existing.class_days || '',
      body.classTime || existing.class_time || '',
      studentId
    ).run();
  } catch (e) {
    if (e.message.includes('no such column')) {
      // Fallback: update without class_days/class_time if migration not applied yet
      await env.DB.prepare(`
        UPDATE users
        SET first_name = ?, last_name = ?, phone = ?, course = ?, status = ?, total_paid = ?, total_due = ?, discount = ?, student_id = ?, assigned_faculty_id = ?, next_payment_date = ?, enrolled_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND role = 'student'
      `).bind(
        required(body.firstName, 'First name'),
        required(body.lastName, 'Last name'),
        body.phone || '',
        required(body.course, 'Course'),
        required(body.status, 'Status'),
        totalPaid,
        numberOrZero(body.totalDue),
        numberOrZero(body.discount),
        body.studentId || '',
        body.assignedFacultyId || '',
        body.nextPaymentDate || '',
        body.enrolledDate || existing.enrolled_date,
        studentId
      ).run();
    } else {
      throw e;
    }
  }

  const paymentDelta = totalPaid - previousPaid;
  if (paymentDelta > 0) {
    await env.DB.prepare('INSERT INTO payments (id, user_id, amount, description, status) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), studentId, paymentDelta, 'Admin update', 'Received')
      .run();
  }

  const updateDetails = describeStudentUpdate(existing, body);
  await logAction(env, user, 'UPDATE_STUDENT', updateDetails, studentId);

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
    INSERT INTO notifications (id, title, body, target_type, target_user_id, target_faculty_id, sent_by, sender_role, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), title, message, targetType, targetUserId, targetFacultyId, user.id, user.role, body.imageUrl || '').run();


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

async function listInstallments({ env }, user, requestedUserId) {
  // If admin/faculty and no specific userId, return all (filtered for faculty)
  if (!requestedUserId) {
    if (user.role === 'admin') {
      const { results } = await env.DB.prepare('SELECT * FROM installments ORDER BY due_date ASC').all();
      return json({ installments: results.map(serializeInstallment) });
    }
    if (user.role === 'faculty') {
      const { results } = await env.DB.prepare(`
        SELECT installments.* FROM installments
        JOIN users ON users.id = installments.user_id
        WHERE users.assigned_faculty_id = ?
        ORDER BY installments.due_date ASC
      `).bind(user.id).all();
      return json({ installments: results.map(serializeInstallment) });
    }
  }

  const userId = requestedUserId || user.id;
  if (user.role === 'student' && userId !== user.id) throw httpError('Not allowed.', 403);
  if (user.role === 'faculty') {
    const student = await env.DB.prepare("SELECT assigned_faculty_id FROM users WHERE id = ? AND role = 'student'").bind(userId).first();
    if (!student || student.assigned_faculty_id !== user.id) throw httpError('Not allowed.', 403);
  }
  const { results } = await env.DB.prepare('SELECT * FROM installments WHERE user_id = ? ORDER BY due_date ASC').bind(userId).all();
  return json({ installments: results.map(serializeInstallment) });
}

async function saveInstallments({ request, env }, user) {
  requireRole(user, ['admin']);
  const body = await readJson(request);
  const userId = required(body.userId, 'User ID');
  const installments = body.installments || []; // Array of { id, amount, due_date, description, status }

  // We'll do a simple sync: delete all and re-insert, or update existing.
  // For simplicity, let's delete all installments for this user and insert the new ones.
  // This is easier for "editing the whole plan".
  
  await env.DB.prepare('DELETE FROM installments WHERE user_id = ?').bind(userId).run();

  if (installments.length > 0) {
    const stmts = installments.map(inst => {
      return env.DB.prepare(`
        INSERT INTO installments (id, user_id, amount, due_date, description, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        inst.id || crypto.randomUUID(),
        userId,
        numberOrZero(inst.amount),
        inst.dueDate || inst.due_date || '',
        inst.description || '',
        inst.status || 'pending'
      );
    });
    await env.DB.batch(stmts);
  }

  return json({ ok: true });
}


function describeStudentUpdate(existing, body) {
  const fields = [
    ['First name', 'first_name', normalizeComparable(body.firstName)],
    ['Last name', 'last_name', normalizeComparable(body.lastName)],
    ['Phone', 'phone', normalizeComparable(body.phone || '')],
    ['Course', 'course', normalizeComparable(body.course)],
    ['Status', 'status', normalizeComparable(body.status)],
    ['Total paid', 'total_paid', normalizeComparable(numberOrZero(body.totalPaid))],
    ['Total due', 'total_due', normalizeComparable(numberOrZero(body.totalDue))],
    ['Discount', 'discount', normalizeComparable(numberOrZero(body.discount))],
    ['Student ID', 'student_id', normalizeComparable(body.studentId || '')],
    ['Assigned faculty', 'assigned_faculty_id', normalizeComparable(body.assignedFacultyId || '')],
    ['Next payment date', 'next_payment_date', normalizeComparable(body.nextPaymentDate || '')],
    ['Enrolled date', 'enrolled_date', normalizeComparable(body.enrolledDate || existing.enrolled_date || '')],
    ['Class days', 'class_days', normalizeComparable(body.classDays || existing.class_days || '')],
    ['Class time', 'class_time', normalizeComparable(body.classTime || existing.class_time || '')]
  ];

  const changes = fields
    .map(([label, column, newValue]) => {
      const oldValue = normalizeComparable(existing[column]);
      if (oldValue === newValue) return null;
      return `${label}: ${formatAuditValue(oldValue)} → ${formatAuditValue(newValue)}`;
    })
    .filter(Boolean);

  if (changes.length === 0) return `Updated student ${existing.email}. No visible field changes.`;
  return `Updated student ${existing.email}. Changes: ${changes.join('; ')}`;
}

function normalizeComparable(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatAuditValue(value) {
  return value === '' ? 'blank' : value;
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
    isSuperAdmin: row.email === SUPER_ADMIN_EMAIL,
    totalPaid: row.total_paid || 0,
    totalDue: row.total_due || 0,
    discount: row.discount || 0,
    nextPaymentDate: row.next_payment_date || '',
    enrolledDate: row.enrolled_date,
    createdAt: row.created_at,
    classDays: row.class_days || '',
    classTime: row.class_time || ''
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
    imageUrl: row.image_url || '',
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

function serializeInstallment(row) {
  return {
    id: row.id,
    amount: row.amount || 0,
    dueDate: row.due_date,
    description: row.description || '',
    status: row.status || 'pending',
    createdAt: row.created_at
  };
}


// ============================================================
// Announcements
// ============================================================
async function listAnnouncements({ env }) {
  const rows = await env.DB.prepare('SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC').all();
  return json({ announcements: rows.results });
}

async function createAnnouncement({ request, env }, user) {
  requireRole(user, ['admin']);
  const body = await readJson(request);
  const title = required(body.title, 'Title');
  const adBody = body.body || '';
  const linkUrl = body.linkUrl || '';
  const linkText = body.linkText || 'Learn More';
  const imageUrl = body.imageUrl || '';
  const videoUrl = body.videoUrl || '';
  const bgGradient = body.bgGradient || 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)';
  const id = randomId().slice(0, 16);
  await env.DB.prepare('INSERT INTO announcements (id, title, body, link_url, link_text, image_url, video_url, bg_gradient, active, created_at) VALUES (?,?,?,?,?,?,?,?,1,?)')
    .bind(id, title, adBody, linkUrl, linkText, imageUrl, videoUrl, bgGradient, new Date().toISOString())
    .run();
  return json({ ok: true, id });
}

async function deleteAnnouncement({ env }, user, id) {
  requireRole(user, ['admin']);
  await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
  await logAction(env, user, 'DELETE_ANNOUNCEMENT', `Deleted announcement ID: ${id}`);
  return json({ ok: true });
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw httpError('Not allowed.', 403);
}

// ============================================================
// Settings — Maintenance Mode
// ============================================================
async function ensureSettingsTable({ env }) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function getMaintenanceMode(context) {
  await ensureSettingsTable(context);
  const row = await context.env.DB.prepare('SELECT value FROM site_settings WHERE key = ?').bind('maintenance_mode').first();
  return json({ enabled: row ? row.value === '1' : false });
}

async function setMaintenanceMode(context, user) {
  requireRole(user, ['admin']);
  const body = await readJson(context.request);
  const enabled = body.enabled ? '1' : '0';
  await ensureSettingsTable(context);
  await context.env.DB.prepare(
    'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).bind('maintenance_mode', enabled, new Date().toISOString()).run();
  return json({ ok: true, enabled: enabled === '1' });
}

// ============================================================
// Password Reset
// ============================================================
async function resetStudentPassword({ request, env }, user, studentId) {
  requireRole(user, ['admin']);
  const body = await readJson(request);
  const newPassword = required(body.newPassword, 'New password');
  if (newPassword.length < 6) throw httpError('Password must be at least 6 characters.', 400);

  const student = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND role = ?').bind(studentId, 'student').first();
  if (!student) throw httpError('Student not found.', 404);

  const salt = randomId().slice(0, 32);
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
    .bind(hash, salt, new Date().toISOString(), studentId)
    .run();

  // Invalidate all sessions for this student
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(studentId).run();

  await logAction(env, user, 'RESET_PASSWORD', `Reset password for student ID: ${studentId}`, studentId);

  return json({ ok: true });
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

// ============================================================
// Other Services (Portals)
// ============================================================
async function ensureServicesTable({ env }) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS other_services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    desc TEXT,
    url TEXT NOT NULL,
    icon TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function listServices(context) {
  await ensureServicesTable(context);
  const { results } = await context.env.DB.prepare('SELECT * FROM other_services WHERE active = 1 ORDER BY created_at DESC').all();
  return json({ services: results });
}

async function createService({ request, env }, user) {
  requireRole(user, ['admin']);
  const body = await readJson(request);
  const name = required(body.name, 'Name');
  const url = required(body.url, 'URL');
  const desc = body.desc || '';
  const icon = body.icon || '🌐';
  
  const id = crypto.randomUUID().slice(0, 8);
  await env.DB.prepare('INSERT INTO other_services (id, name, desc, url, icon) VALUES (?, ?, ?, ?, ?)')
    .bind(id, name, desc, url, icon)
    .run();
    
  return json({ ok: true, id });
}

async function deleteService({ env }, user, id) {
  requireRole(user, ['admin']);
  await env.DB.prepare('DELETE FROM other_services WHERE id = ?').bind(id).run();
  await logAction(env, user, 'DELETE_SERVICE', `Deleted service ID: ${id}`);
  return json({ ok: true });
}

// ============================================================
// Super Admin & Audit Logs
// ============================================================

async function listAllUsers({ env }, user) {
  if (user.email !== SUPER_ADMIN_EMAIL) throw httpError('Unauthorized.', 403);
  await ensureUserCompatibilityColumns(env);
  const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return json({ users: results.map(serializeUser) });
}

async function updateUserRole({ request, env }, user, targetUserId) {
  if (user.email !== SUPER_ADMIN_EMAIL) throw httpError('Unauthorized.', 403);
  const body = await readJson(request);
  const newRole = required(body.role, 'Role');
  if (!['student', 'admin', 'faculty'].includes(newRole)) throw httpError('Invalid role.', 400);

  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetUserId).first();
  if (!target) throw httpError('User not found.', 404);

  await env.DB.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(newRole, targetUserId)
    .run();

  await logAction(env, user, 'UPDATE_USER_ROLE', `Changed role of ${target.email} from ${target.role} to ${newRole}`, targetUserId);
  return json({ ok: true });
}

async function ensureAuditLogsTable({ env }) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    target_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await ensureColumns(env, 'audit_logs', [
    ['user_id', 'TEXT DEFAULT \'\''],
    ['admin_email', 'TEXT DEFAULT \'\''],
    ['action', 'TEXT DEFAULT \'UNKNOWN\''],
    ['details', 'TEXT DEFAULT \'\''],
    ['target_id', 'TEXT DEFAULT \'\''],
    ['created_at', 'TEXT DEFAULT \'\'']
  ]);
}

async function listAuditLogs(context, user) {
  requireRole(user, ['admin']);
  await ensureAuditLogsTable(context);
  const { results } = await context.env.DB.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all();
  return json({ logs: results });
}

// ============================================================
// Academic Calendar
// ============================================================
async function ensureCalendarTable({ env }) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS academic_calendar (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT DEFAULT 'event',
    desc TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function listCalendar(context) {
  await ensureCalendarTable(context);
  const { results } = await context.env.DB.prepare('SELECT * FROM academic_calendar ORDER BY date ASC').all();
  return json({ calendar: results });
}

async function createCalendarEntry({ request, env }, user) {
  requireRole(user, ['admin']);
  const body = await readJson(request);
  const title = required(body.title, 'Title');
  const date = required(body.date, 'Date');
  const type = body.type || 'event';
  const desc = body.desc || '';

  const id = crypto.randomUUID().slice(0, 8);
  await env.DB.prepare('INSERT INTO academic_calendar (id, title, date, type, desc) VALUES (?, ?, ?, ?, ?)')
    .bind(id, title, date, type, desc)
    .run();
  
  await logAction(env, user, 'CREATE_CALENDAR', `Added ${type}: ${title} on ${date}`);
  return json({ ok: true, id });
}

async function deleteCalendarEntry({ env }, user, id) {
  requireRole(user, ['admin']);
  await env.DB.prepare('DELETE FROM academic_calendar WHERE id = ?').bind(id).run();
  await logAction(env, user, 'DELETE_CALENDAR', `Deleted calendar entry ID: ${id}`);
  return json({ ok: true });
}


async function ensureUserCompatibilityColumns(env) {
  await ensureColumns(env, 'users', [
    ['phone', "TEXT DEFAULT ''"],
    ['course', "TEXT DEFAULT ''"],
    ['student_id', "TEXT DEFAULT ''"],
    ['assigned_faculty_id', "TEXT DEFAULT ''"],
    ['status', "TEXT DEFAULT 'pending'"],
    ['total_paid', 'INTEGER DEFAULT 0'],
    ['total_due', 'INTEGER DEFAULT 0'],
    ['discount', 'INTEGER DEFAULT 0'],
    ['enrolled_date', "TEXT DEFAULT ''"],
    ['created_at', "TEXT DEFAULT ''"],
    ['updated_at', "TEXT DEFAULT ''"],
    ['next_payment_date', "TEXT DEFAULT ''"],
    ['class_days', "TEXT DEFAULT ''"],
    ['class_time', "TEXT DEFAULT ''"]
  ]);
}

async function ensureColumns(env, tableName, columns) {
  const existing = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
  const existingNames = new Set((existing.results || []).map(column => column.name));

  for (const [name, definition] of columns) {
    if (existingNames.has(name)) continue;
    try {
      await env.DB.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${definition}`).run();
      existingNames.add(name);
    } catch (e) {
      if (!String(e.message || '').toLowerCase().includes('duplicate column')) throw e;
    }
  }
}

async function logAction(env, admin, action, details, targetId = null) {
  try {
    await ensureAuditLogsTable({ env });
    await env.DB.prepare('INSERT INTO audit_logs (id, user_id, admin_email, action, details, target_id) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), admin.id, admin.email, action, details, targetId)
      .run();
  } catch (e) {
    console.error('Logging failed:', e);
  }
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
