// ============================================================
// AIMS LMS — Shared App Data
// ============================================================

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
