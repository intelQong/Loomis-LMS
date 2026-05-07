// ============================================================
// AIMS LMS — Auth Logic
// ============================================================

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelector(`#${tab}Form`).classList.add('active');
  event.target.classList.add('active');
}

function togglePw(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!email || !password) {
    showError(errEl, 'Please fill in all fields.');
    return;
  }

  try {
    showLoading(true);
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged will handle redirect
  } catch (e) {
    showLoading(false);
    showError(errEl, getAuthError(e.code));
  }
}

async function handleSignup() {
  const first = document.getElementById('signupFirst').value.trim();
  const last = document.getElementById('signupLast').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const course = document.getElementById('signupCourse').value;
  const password = document.getElementById('signupPassword').value;
  const studentId = document.getElementById('signupStudentId').value.trim();
  const errEl = document.getElementById('signupError');
  errEl.classList.add('hidden');

  if (!first || !last || !email || !course || !password) {
    showError(errEl, 'Please fill in all required fields.');
    return;
  }
  if (password.length < 8) {
    showError(errEl, 'Password must be at least 8 characters.');
    return;
  }

  try {
    showLoading(true);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    
    // Save user profile to Firestore
    await db.collection('users').doc(cred.user.uid).set({
      firstName: first,
      lastName: last,
      email: email,
      phone: phone || '',
      course: course,
      studentId: studentId || '',
      role: 'student',
      status: 'pending', // Admin must approve
      totalPaid: 0,
      totalDue: COURSES[course] ? COURSES[course].totalFee : 0,
      enrolledDate: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Sign out immediately - need admin approval
    await auth.signOut();
    showLoading(false);
    
    // Show success message
    const errEl = document.getElementById('signupError');
    errEl.className = 'success-msg';
    errEl.textContent = '✅ Account created! Please wait for admin approval before logging in.';
    errEl.classList.remove('hidden');
    
  } catch (e) {
    showLoading(false);
    showError(errEl, getAuthError(e.code));
  }
}

// Auth state observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userData = await getCurrentUserData();
      if (!userData) { await auth.signOut(); return; }
      
      if (userData.status === 'pending') {
        await auth.signOut();
        const errEl = document.getElementById('loginError');
        showError(errEl, 'Your account is pending admin approval.');
        showLoading(false);
        return;
      }
      
      if (userData.status === 'suspended') {
        await auth.signOut();
        const errEl = document.getElementById('loginError');
        showError(errEl, 'Your account has been suspended. Contact AIMS admin.');
        showLoading(false);
        return;
      }

      // Redirect based on role
      if (userData.role === 'admin' || userData.role === 'faculty') {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'student-dashboard.html';
      }
    } catch(e) {
      showLoading(false);
      console.error(e);
    }
  } else {
    showLoading(false);
  }
});

function showError(el, msg) {
  el.textContent = msg;
  el.className = 'error-msg';
  el.classList.remove('hidden');
}

function showLoading(show) {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = show ? 'flex' : 'none';
}

function getAuthError(code) {
  const errors = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password is too weak.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return errors[code] || 'An error occurred. Please try again.';
}
