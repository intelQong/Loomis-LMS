// ============================================================
// Loomis LMS — Shared App Data
// ============================================================

// ============================================================
// Course config — central definition
// ============================================================
var COURSES = {
  'ielts-regular': {
    name: 'IELTS Regular (AC/GT)',
    icon: '',
    category: 'IELTS',
    duration: '3 Months',
    sessions: '36 classes',
    originalFee: 10000,
    totalFee: 7000,
    features: [
      { icon: '', label: '25 CD Mock Tests' },
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ],
    defaultSchedule: { days: 'Sat, Mon, Wed', time: 'TBA' }
  },
  'ielts-fast-track': {
    name: 'IELTS Fast Track',
    icon: '',
    category: 'IELTS',
    duration: '1.5 Months',
    sessions: '18 classes',
    originalFee: 10000,
    totalFee: 7000,
    features: [
      { icon: '', label: '25 CD Mock Tests' },
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ]
  },
  'ielts-platinum': {
    name: 'IELTS Platinum',
    icon: '',
    category: 'IELTS',
    duration: '3 Months',
    sessions: '36 classes',
    originalFee: 20000,
    totalFee: 15000,
    features: [
      { icon: '', label: '40 CD Mock Tests' },
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ]
  },
  'ielts-online': {
    name: 'IELTS Live/Online',
    icon: '',
    category: 'IELTS',
    duration: '3 Months',
    sessions: '36 classes',
    originalFee: 7000,
    totalFee: 3000,
    features: [
      { icon: '', label: '10 CD Mock Tests' },
      { icon: '', label: '2 Months Language Lounge Access' }
    ]
  },
  'ielts-skill-focus': {
    name: 'IELTS Skill Focus',
    icon: '',
    category: 'IELTS',
    duration: '1 Month',
    sessions: '12 classes',
    totalFee: 2500,
    features: [
      { icon: '', label: '1 Month Language Lounge Access' }
    ]
  },
  'executive-ielts': {
    name: 'Executive IELTS (Fri/Sat)',
    icon: '',
    category: 'IELTS',
    duration: '4 Months',
    sessions: '16+ classes',
    totalFee: 7000,
    features: [
      { icon: '', label: '25 CD Mock Tests' },
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ]
  },
  'pte-academic': {
    name: 'PTE Academic',
    icon: '',
    category: 'PTE',
    duration: '2 Months',
    sessions: '24 classes',
    originalFee: 10000,
    totalFee: 8000,
    features: [
      { icon: '', label: '25 CD Mock Tests' },
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ]
  },
  'spoken-english': {
    name: 'Spoken English',
    icon: '',
    category: 'Spoken English',
    duration: '2 Months',
    sessions: '24 classes',
    totalFee: 4500,
    features: [
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ],
    defaultSchedule: { days: '3 days a week', sessions: 24, time: 'TBA' }
  },
  'business-english': {
    name: 'Business English for Professionals',
    icon: '',
    category: 'Spoken English',
    duration: '4 Months',
    sessions: 'Friday classes',
    totalFee: 6000,
    features: [
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ]
  },
  'spoken-english-online': {
    name: 'Spoken English (Online)',
    icon: '',
    category: 'Spoken English',
    duration: '3 Months',
    sessions: 'Online classes',
    totalFee: 2000,
    features: [
      { icon: '', label: '6 Months Language Lounge Access' },
      { icon: '', label: '6 Months Movie Club Access' }
    ]
  },
  'foundation-english': {
    name: 'Foundation English & Phonetics',
    icon: '',
    category: 'Spoken English',
    duration: '1 Month',
    sessions: '13 classes',
    totalFee: 2500,
    features: [
      { icon: '', label: '2 Months Language Lounge Access' },
      { icon: '', label: '2 Months Movie Club Access' }
    ],
    defaultSchedule: { days: 'TBA', sessions: 13, time: 'TBA' }
  }
};


function getCourseIds(userOrValue) {
  const value = userOrValue && typeof userOrValue === 'object'
    ? (userOrValue.courses && userOrValue.courses.length ? userOrValue.courses : userOrValue.course)
    : userOrValue;
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const ids = raw.map(id => String(id).trim()).filter(id => COURSES[id]);
  return [...new Set(ids)];
}

function getCourseList(userOrValue) {
  return getCourseIds(userOrValue).map(id => ({ id, ...COURSES[id] }));
}

function getCourseNames(userOrValue) {
  const courses = getCourseList(userOrValue);
  return courses.length ? courses.map(course => course.name).join(', ') : '—';
}

function getCourseTotalFee(userOrValue) {
  return getCourseList(userOrValue).reduce((sum, course) => sum + (course.totalFee || 0), 0);
}
