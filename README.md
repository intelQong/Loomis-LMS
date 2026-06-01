<p align="center">
  <img src="assets/intelqong-logo.svg" alt="Loomis LMS" width="200">
</p>

<h1 align="center">Loomis LMS</h1>

<p align="center">
  <strong>Open-source learning management system built on Cloudflare Pages + D1</strong><br>
  A modern, self-hosted LMS for learning centers, coaching institutes, and small educational organizations.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#forking--customization">Forking</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#api-reference">API</a> •
  <a href="#security">Security</a> •
  <a href="#license">License</a>
</p>

---

## Features

### 🎓 Student Dashboard
- **Course overview** — View enrolled courses, class schedule, duration, and included features
- **Payment tracking** — See total fees, amount paid, remaining dues, and installment plans
- **Broadcast inbox** — Receive targeted or mass announcements from admins/faculty
- **Academic calendar** — View upcoming holidays, exams, and events
- **Attendance history** — Track personal attendance records
- **Profile management** — View enrollment info, student ID, and account details
- **Theme customization** — Choose from Teal, Indigo, Coral, or Emerald color themes
- **Self-service password change** — Update password without contacting support

### 🛡️ Admin Dashboard
- **Student management** — Create, approve, edit, suspend, or search students with filters
- **Financial insights** — Track total collected, due collections, with period-based filtering
- **Broadcast system** — Send rich notifications (text + images) to all, individual, or assigned students
- **Announcement banners** — Create rich banners with images, video embeds, gradients, and CTA buttons
- **Payment records** — View and sort payment history across all students
- **Installment plans** — Create and manage installment schedules per student
- **Academic calendar** — Add/remove events, holidays, and exam dates
- **Other services** — Manage external links displayed on the student dashboard
- **Attendance tracking** — Mark daily attendance by course, with bulk actions
- **Maintenance mode** — Toggle a site-wide maintenance page for students
- **Service worker tools** — Clear browser caches and force-reload for all visitors

### 👑 Super Admin Portal
- **User management** — View all users and change roles (student → admin/faculty)
- **System audit logs** — Permanent, immutable history of all administrative actions
- **Auto-promotion** — Configure a super admin email that auto-promotes on first login

### 🔐 Security
- **PBKDF2 password hashing** — 100,000 iterations with unique salts
- **Application-level rate limiting** — Protects login, signup, password reset, and admin actions
- **Same-origin enforcement** — Blocks cross-site form submissions
- **HTTP security headers** — CSP, X-Frame-Options, HSTS, Referrer-Policy
- **Session management** — HTTP-only cookies, automatic invalidation on password change
- **Account enumeration protection** — Generic error messages on failed login

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (no framework) |
| **Backend** | Cloudflare Pages Functions (serverless, edge) |
| **Database** | Cloudflare D1 (SQLite-based, serverless) |
| **Hosting** | Cloudflare Pages (global CDN) |
| **Auth** | Cookie-based sessions with PBKDF2 hashing |
| **CI/CD** | GitHub Actions → Cloudflare Pages |

**Zero dependencies** — No React, no build tools, no npm packages in production. Just HTML/CSS/JS served from the edge.

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- A free [Cloudflare](https://dash.cloudflare.com/) account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)

### Local Development

```bash
# Clone the repository
git clone https://github.com/qongBIT/Loomis-LMS.git
cd Loomis-LMS

# Install dev dependencies
npm install

# Create a local D1 database and apply migrations
npm run d1:migrate:local

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:8788`.

### First Admin Setup

1. Open the app and **sign up** with any email
2. The first user matching the `SUPER_ADMIN_EMAIL` in [`functions/api/[[path]].js`](functions/api/%5B%5Bpath%5D%5D.js) will be auto-promoted to admin
3. Or manually promote via D1:
   ```bash
   npx wrangler d1 execute loomis_lms --local --command \
     "UPDATE users SET role='admin', status='active' WHERE email='your@email.com';"
   ```

---

## Deployment

### Option A: GitHub Actions (Recommended)

1. Fork this repo
2. Add these secrets in **Settings → Secrets → Actions**:
   - `CLOUDFLARE_API_TOKEN` — API token with Pages + D1 permissions
   - `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID
3. Run the **"Cloudflare D1 Setup"** workflow with `create_database=true` (once only)
4. Copy the `database_id` from the workflow output into `wrangler.toml`
5. Push to `main` — the **"Deploy Cloudflare Pages"** workflow auto-deploys

### Option B: Manual Deployment

```bash
# Create the D1 database (once)
npm run d1:create

# Apply migrations to production
npm run d1:migrate:remote

# Deploy to Cloudflare Pages
npm run deploy
```

### Custom Domain

1. Go to **Cloudflare Dashboard → Pages → your project → Custom domains**
2. Add your domain (e.g., `student.yourdomain.com`)
3. Cloudflare will auto-configure DNS and SSL

---

## Forking & Customization

Loomis LMS is designed to be **forked and customized** for your own learning center. Here's what you need to change:

### ⚙️ Required Changes

| What | File | Line | Description |
|------|------|------|-------------|
| **Super Admin Email** | [`functions/api/[[path]].js`](functions/api/%5B%5Bpath%5D%5D.js) | `16` | Change `SUPER_ADMIN_EMAIL` to your email |
| **D1 Database ID** | [`wrangler.toml`](wrangler.toml) | `13` | Replace with your own D1 database ID |
| **Project Name** | [`wrangler.toml`](wrangler.toml) | `1` | Change to your Cloudflare Pages project name |
| **Project Name** | [`package.json`](package.json) | `2, 12-16` | Update npm scripts with your project/db name |

### 🎨 Optional Branding Changes

| What | File(s) | Description |
|------|---------|-------------|
| **Logo** | [`assets/intelqong-logo.svg`](assets/intelqong-logo.svg) | Replace with your own SVG logo |
| **App Name** | `index.html`, `student-dashboard.html`, `admin-dashboard.html`, `manifest.json` | Search for "Loomis LMS" and replace |
| **Contact Info** | [`student-dashboard.html`](student-dashboard.html) | Update address, email, phone, WhatsApp, Maps link, LinkedIn |
| **Courses** | [`js/app-data.js`](js/app-data.js) + [`functions/api/[[path]].js`](functions/api/%5B%5Bpath%5D%5D.js) | Modify `COURSES` object in both files |
| **Theme Colors** | [`styles/main.css`](styles/main.css) | Update CSS custom properties |
| **Seeded Services** | [`migrations/0008_other_services.sql`](migrations/0008_other_services.sql) | Change initial "Other Services" links |

### 🔗 Hardcoded Values to Update

These values are specific to the original deployment and should be changed when forking:

```
student-dashboard.html:
  - WhatsApp link:  https://wa.me/10000000000
  - Google Maps:    https://maps.google.com
  - Email:          contact@example.com
  - Address:         Your Center Address,15  Your AreaRoad, Chattogram
  - Contact name:   Operations Team
  - LinkedIn:       https://example.com

js/student-dashboard.js:
  - Maintenance WhatsApp:  https://wa.me/00000000000(line ~25)
  - British Council text: line ~253

functions/api/[[path]].js:
  - SUPER_ADMIN_EMAIL:  admin@example.com(line 16)

migrations/0008_other_services.sql:
  - Seeded URL: https://example.com
```

---

## Project Structure

```
loomis-lms/
├── index.html                      # Login / Signup page
├── student-dashboard.html          # Student portal
├── admin-dashboard.html            # Admin + Faculty portal
├── manifest.json                   # PWA manifest
├── sw.js                           # Service worker (cache management)
├── _headers                        # Cloudflare security headers + CSP
├── _redirects                      # Cloudflare URL redirects
├── wrangler.toml                   # Cloudflare Pages + D1 config
├── package.json                    # npm scripts for dev/deploy
│
├── assets/
│   └── intelqong-logo.svg          # Brand logo (replace with yours)
│
├── styles/
│   ├── main.css                    # Design system & CSS variables
│   ├── auth.css                    # Login/signup page styles
│   ├── dashboard.css               # Shared dashboard styles
│   └── admin.css                   # Admin-specific styles
│
├── js/
│   ├── app-data.js                 # Course definitions & shared utils
│   ├── api-client.js               # API fetch wrapper
│   ├── auth.js                     # Login/signup logic
│   ├── student-dashboard.js        # Student dashboard logic
│   └── admin-dashboard.js          # Admin dashboard logic
│
├── functions/
│   └── api/
│       └── [[path]].js             # All backend API routes (single file)
│
├── migrations/
│   ├── 0001_init.sql               # Core tables: users, sessions, etc.
│   ├── 0002_next_payment.sql       # Payment date column
│   ├── 0003_announcements.sql      # Announcement banners
│   ├── 0004_installments.sql       # Installment plans
│   ├── 0005_notification_image.sql # Notification images
│   ├── 0006_announcement_video.sql # Video embeds
│   ├── 0007_class_schedule.sql     # Class days/time columns
│   ├── 0008_other_services.sql     # External links/services
│   ├── 0009_audit_logs.sql         # System audit trail
│   ├── 0010_academic_calendar.sql  # Calendar events/holidays
│   ├── 0011_rate_limits.sql        # Rate limiting table
│   ├── 0012_user_courses.sql       # Multi-course support
│   └── 0013_attendance_records.sql # Attendance tracking
│
└── .github/workflows/
    ├── ci.yml                      # Syntax checks on PR
    ├── deploy-cloudflare-pages.yml # Auto-deploy on push to main
    └── cloudflare-d1-setup.yml     # One-click D1 setup workflow
```

---

## API Reference

All endpoints are under `/api/`. Authentication is via HTTP-only session cookies.

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/signup` | — | Register a new student (pending approval) |
| `POST` | `/api/auth/login` | — | Sign in and receive session cookie |
| `POST` | `/api/auth/logout` | ✅ | Destroy current session |
| `GET` | `/api/auth/me` | ✅ | Get current user profile |
| `POST` | `/api/auth/change-password` | ✅ | Change own password |
| `POST` | `/api/auth/forgot-password` | — | Request admin password reset |

### Students (Admin/Faculty)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/students` | Admin/Faculty | List students |
| `POST` | `/api/students` | Admin/Faculty | Create a student |
| `PATCH` | `/api/students/:id` | Admin/Faculty | Update student details |
| `POST` | `/api/students/:id/reset-password` | Admin | Reset student password |

### Notifications & Announcements
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/notifications` | ✅ | List broadcasts |
| `POST` | `/api/notifications` | Admin/Faculty | Send broadcast |
| `DELETE` | `/api/notifications/:id` | Admin | Delete broadcast |
| `GET` | `/api/announcements` | ✅ | List announcement banners |
| `POST` | `/api/announcements` | Admin | Create announcement |
| `PATCH` | `/api/announcements/:id` | Admin | Update announcement |
| `DELETE` | `/api/announcements/:id` | Admin | Delete announcement |

### Payments & Installments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/payments` | ✅ | List payment history |
| `GET` | `/api/installments` | ✅ | List installment plan |
| `POST` | `/api/installments` | Admin | Save installment plan |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET/POST/DELETE` | `/api/services` | ✅/Admin | Manage external services |
| `GET/POST/DELETE` | `/api/calendar` | ✅/Admin | Manage academic calendar |
| `GET/POST` | `/api/attendance` | ✅/Admin | Attendance records |
| `GET/PUT` | `/api/settings/maintenance` | ✅/Admin | Maintenance mode toggle |
| `GET` | `/api/admin/users` | Super Admin | List all users |
| `PATCH` | `/api/admin/users/:id` | Super Admin | Change user role |
| `GET` | `/api/admin/logs` | Super Admin | View audit logs |

---

## Security

See [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for a detailed security review.

**Key protections:**
- PBKDF2-SHA-256 password hashing (100k iterations)
- D1-backed rate limiting on all auth endpoints
- Same-origin request enforcement
- HTTP-only session cookies with SameSite
- Content Security Policy (CSP)
- Automatic session invalidation on password change
- Immutable audit logs for all admin actions

**Recommended Cloudflare WAF rules** for production:
1. Managed Challenge for high-rate `POST /api/auth/login` traffic
2. Bot Fight Mode or Super Bot Fight Mode
3. Cloudflare Turnstile on login/signup if automated abuse is detected

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

<p align="center">
  Built with ❤️ on <a href="https://pages.cloudflare.com/">Cloudflare Pages</a> + <a href="https://developers.cloudflare.com/d1/">Cloudflare D1</a>
</p>
