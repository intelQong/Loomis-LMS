// ============================================================
// AIMS LMS — Firebase Configuration
// Replace these values with your Firebase project config
// Free tier: Spark plan (no billing required)
// ============================================================

// HOW TO SETUP:
// 1. Go to https://console.firebase.google.com
// 2. Create project: "aims-lms"
// 3. Enable Authentication → Email/Password
// 4. Enable Firestore Database
// 5. Copy your config from Project Settings → General → Your apps
// 6. Replace the values below

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ============================================================
// Firebase SDK (loaded via CDN in HTML files)
// These must be included BEFORE this script:
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
// ============================================================

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================
// Firestore Security Rules (paste in Firebase Console → Firestore → Rules)
// ============================================================
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function currentUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }
    function currentRole() {
      return currentUser().data.role;
    }
    function isAdmin() {
      return signedIn() && currentRole() == 'admin';
    }
    function isFaculty() {
      return signedIn() && currentRole() == 'faculty';
    }
    function studentAssignedToFaculty(studentId) {
      return get(/databases/$(database)/documents/users/$(studentId)).data.assignedFacultyId == request.auth.uid;
    }

    match /users/{userId} {
      allow read: if signedIn() && (
        request.auth.uid == userId ||
        isAdmin() ||
        (isFaculty() && resource.data.role == 'student' && resource.data.assignedFacultyId == request.auth.uid)
      );
      allow write: if signedIn() && (
        request.auth.uid == userId ||
        isAdmin()
      );
      match /payments/{payId} {
        allow read: if signedIn() && (
          request.auth.uid == userId ||
          isAdmin() ||
          (isFaculty() && studentAssignedToFaculty(userId))
        );
        allow write: if signedIn() && isAdmin();
      }
    }

    match /notifications/{notifId} {
      allow read: if signedIn() && (
        resource.data.targetType == 'all' ||
        resource.data.targetUserId == request.auth.uid ||
        (resource.data.targetType == 'assigned' && resource.data.targetFacultyId == currentUser().data.assignedFacultyId) ||
        isAdmin() ||
        (isFaculty() && resource.data.sentBy == request.auth.uid)
      );
      allow create: if signedIn() && (
        isAdmin() ||
        (isFaculty() && request.resource.data.sentBy == request.auth.uid && (
          (request.resource.data.targetType == 'assigned' && request.resource.data.targetFacultyId == request.auth.uid) ||
          (request.resource.data.targetType == 'individual' && studentAssignedToFaculty(request.resource.data.targetUserId))
        ))
      );
      allow delete: if signedIn() && (
        isAdmin() ||
        (isFaculty() && resource.data.sentBy == request.auth.uid)
      );
    }
  }
}
*/

// ============================================================
// Helper: Get current user data from Firestore
// ============================================================
async function getCurrentUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  const doc = await db.collection('users').doc(user.uid).get();
  return doc.exists ? { id: user.uid, ...doc.data() } : null;
}

// ============================================================
// Helper: Check if user is admin
// ============================================================
async function isAdmin() {
  const data = await getCurrentUserData();
  return data && data.role === 'admin';
}

// ============================================================
// Course config — central definition
// ============================================================
const COURSES = {
  'ielts-academic': {
    name: 'IELTS Academic',
    icon: '🎓',
    duration: '3 months',
    sessions: '36 classes',
    totalFee: 15000,
    features: [
      { icon: '📖', label: 'Reading Module (Academic)' },
      { icon: '✍️', label: 'Writing Task 1 & 2' },
      { icon: '🎧', label: 'Listening Practice' },
      { icon: '🗣️', label: 'Speaking Sessions' },
      { icon: '📝', label: 'Mock Tests (Band 4–9)' },
      { icon: '📊', label: 'Progress Tracking' },
      { icon: '📚', label: 'Study Materials' },
      { icon: '🏅', label: 'British Council Affiliated' }
    ]
  },
  'ielts-general': {
    name: 'IELTS General Training',
    icon: '📋',
    duration: '3 months',
    sessions: '36 classes',
    totalFee: 13000,
    features: [
      { icon: '📖', label: 'Reading Module (General)' },
      { icon: '✍️', label: 'Writing Task 1 (Letters) & 2' },
      { icon: '🎧', label: 'Listening Practice' },
      { icon: '🗣️', label: 'Speaking Sessions' },
      { icon: '📝', label: 'Mock Tests' },
      { icon: '📊', label: 'Progress Tracking' },
      { icon: '📚', label: 'Study Materials' },
      { icon: '🏅', label: 'British Council Affiliated' }
    ]
  },
  'spoken-english': {
    name: 'Spoken English',
    icon: '💬',
    duration: '2 months',
    sessions: '24 classes',
    totalFee: 8000,
    features: [
      { icon: '🗣️', label: 'Daily Conversation Practice' },
      { icon: '🎙️', label: 'Pronunciation Training' },
      { icon: '📰', label: 'Vocabulary Building' },
      { icon: '🎧', label: 'Listening & Comprehension' },
      { icon: '🤝', label: 'Group Discussion Sessions' },
      { icon: '🎬', label: 'Audio-Visual Materials' }
    ]
  },
  'business-english': {
    name: 'Business English',
    icon: '💼',
    duration: '2 months',
    sessions: '24 classes',
    totalFee: 10000,
    features: [
      { icon: '📧', label: 'Business Writing & Email' },
      { icon: '🗣️', label: 'Presentation Skills' },
      { icon: '🤝', label: 'Meeting & Negotiation English' },
      { icon: '📊', label: 'Report Writing' },
      { icon: '💬', label: 'Professional Communication' },
      { icon: '📚', label: 'Industry Vocabulary' }
    ]
  }
};

const PORTALS = [
  {
    icon: '🌐',
    name: 'AIMS English Website',
    desc: 'Official website with course info, news, and announcements.',
    url: 'https://www.aims-english.com'
  },
  {
    icon: '📅',
    name: 'Class Schedule',
    desc: 'View your class timetable and upcoming sessions.',
    url: '#schedule'
  },
  {
    icon: '📝',
    name: 'IELTS Practice',
    desc: 'Access practice tests and band scoring tools.',
    url: '#ielts-practice'
  },
  {
    icon: '🎓',
    name: 'Study Resources',
    desc: 'Download study materials, notes and worksheets.',
    url: '#resources'
  }
];
