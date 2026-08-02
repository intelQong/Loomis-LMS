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
  <a href="#documentation">Docs</a> •
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

### Configuration

All deployment-specific values are environment variables — nothing sensitive lives in the repo.

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPER_ADMIN_EMAIL` | Yes | Account auto-promoted to super admin on first login |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy only | Used by the GitHub Actions workflows |
| `CLOUDFLARE_API_TOKEN` | Deploy only | Used by the GitHub Actions workflows |

Set `SUPER_ADMIN_EMAIL` in **Cloudflare Dashboard → Pages → your project → Settings → Environment variables**. For local development, copy `.env.example` to `.dev.vars` (git-ignored) and fill it in.

**There is no default, by design.** If `SUPER_ADMIN_EMAIL` is unset the super admin role simply does not exist — every super-admin-only endpoint returns 403 and no account is auto-promoted. A placeholder default would be an address anyone could sign up as to claim admin.

`wrangler.toml` ships with `database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"`. Replace it with the ID printed by `npm run d1:create`, or bind D1 in the Pages dashboard instead (Settings → Functions → D1 bindings → variable name `DB`).

### First Admin Setup

1. Set `SUPER_ADMIN_EMAIL` to the email you plan to use
2. Open the app and **sign up** with that email — the account is auto-promoted to admin on first login
3. Or promote any existing user manually:
   ```bash
   npx wrangler d1 execute loomis_lms --local --command \
     "UPDATE users SET role='admin', status='active' WHERE email='you@example.com';"
   ```
   In production, the **Cloudflare D1 Setup** workflow does the same via its `promote_admin_email` input.

---

## Deployment

### Option A: GitHub Actions (Recommended)

1. Fork this repo
2. Add these secrets in **Settings → Secrets and variables → Actions**:
   - `CLOUDFLARE_API_TOKEN` — API token with Pages + D1 permissions
   - `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID
3. Run the **"Cloudflare D1 Setup"** workflow with `create_database=true` (once only)
4. Copy the `database_id` from the workflow output into `wrangler.toml`
5. Set `SUPER_ADMIN_EMAIL` as a Pages environment variable
6. Push to `main` — the **"Deploy Cloudflare Pages"** workflow auto-deploys

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

Loomis LMS is designed to be **forked and customized** for your own learning center. It ships with placeholder content only — no real contact details, credentials, or infrastructure IDs.

### ⚙️ Required

| What | Where |
|------|-------|
| **Super Admin Email** | `SUPER_ADMIN_EMAIL` environment variable |
| **D1 Database ID** | [`wrangler.toml`](wrangler.toml) — replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` |
| **Project & DB Name** | [`wrangler.toml`](wrangler.toml) and the npm scripts in [`package.json`](package.json) — both use `loomis_lms` / `loomis-lms` |

### 🎨 Placeholders to Replace

Every value below is a stub. Grep for it and swap in your own.

| Placeholder | Where | What it is |
|-------------|-------|------------|
| `contact@example.com` | `student-dashboard.html` | Support email on the Contact page |
| `https://wa.me/10000000000` | `student-dashboard.html`, `js/student-dashboard.js` | WhatsApp contact + maintenance-mode fallback |
| `https://maps.google.com/` | `student-dashboard.html` | "Open in Maps" link |
| `Your Center Name, Street Address` | `student-dashboard.html` | Physical address block |
| `https://example.com` | `migrations/0008_other_services.sql` | Seeded "Other Services" link |

### 🖌️ Branding

| What | Where |
|------|-------|
| **Logo** | [`assets/intelqong-logo.svg`](assets/intelqong-logo.svg) — replace the file, or rename it and update `index.html`, both dashboards, `manifest.json`, and `sw.js` |
| **App Name** | Search for `Loomis LMS` across the HTML files and `manifest.json` |
| **Courses** | `COURSES` in [`js/app-data.js`](js/app-data.js) (display data) **and** [`functions/api/[[path]].js`](functions/api/%5B%5Bpath%5D%5D.js) (fee validation) — keep the IDs in sync |
| **Theme Colors** | CSS custom properties in [`styles/main.css`](styles/main.css) |

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
├── .env.example                    # Documented env vars (copy to .dev.vars locally)
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
├── scripts/
│   ├── check-html.py               # HTML parse check (npm run check:html)
│   └── test-super-admin.mjs        # Super admin gating test (npm test)
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

**Secrets policy:** no credentials, API tokens, or account identifiers are committed. Cloudflare credentials live in GitHub Actions secrets, `SUPER_ADMIN_EMAIL` is a Pages environment variable, and `.dev.vars` is git-ignored for local overrides.

**Recommended Cloudflare WAF rules** for production:
1. Managed Challenge for high-rate `POST /api/auth/login` traffic
2. Bot Fight Mode or Super Bot Fight Mode
3. Cloudflare Turnstile on login/signup if automated abuse is detected

---

## Documentation

| Document | Contents |
|----------|----------|
| [SETUP-GUIDE.md](SETUP-GUIDE.md) | Step-by-step deployment walkthrough (also available as [PDF](SETUP-GUIDE.pdf)) |
| [SECURITY-AUDIT.md](SECURITY-AUDIT.md) | Security review, findings, and remediations |
| [LOOMIS-LMS-BENEFITS.md](LOOMIS-LMS-BENEFITS.md) | Problems this system solves, written for non-technical stakeholders |

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
