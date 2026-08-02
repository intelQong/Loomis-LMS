<p align="center">
  <img src="assets/intelqong-logo.svg" alt="Loomis LMS" width="200">
</p>

<h1 align="center">Loomis LMS</h1>

<p align="center">
  <strong>A self-hosted learning management system for coaching centers, built entirely on Cloudflare's edge.</strong>
</p>

<p align="center">
  <a href="https://github.com/qongBIT/Loomis-LMS/actions/workflows/ci.yml"><img src="https://github.com/qongBIT/Loomis-LMS/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-GPLv3-blue.svg" alt="License: GPLv3">
  <img src="https://img.shields.io/badge/runtime-Cloudflare%20Pages%20%2B%20D1-orange.svg" alt="Cloudflare Pages + D1">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen.svg" alt="Zero runtime dependencies">
</p>

<p align="center">
  <a href="#what-it-does">What It Does</a> •
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

## What It Does

Small coaching centers run on WhatsApp threads, paper ledgers, and a spreadsheet somebody forgot to back up. Enrollment lives in one place, fee collection in another, and the answer to "has this student paid?" depends on who you ask.

Loomis LMS replaces that with one system:

- **Students** sign in to see their courses, class schedule, fee balance, installment plan, attendance record, and announcements from the center.
- **Admins and faculty** enroll and approve students, record payments, set up installment plans, mark attendance by course, broadcast notices, and manage the academic calendar.
- **A super admin** controls roles and reads an immutable audit log of every administrative action.

It is deliberately small. No framework, no build step, no runtime dependencies — static HTML, CSS, and JavaScript in front of a single Cloudflare Pages Function and a D1 database. The whole thing runs comfortably inside Cloudflare's free tier, which matters when the alternative is a per-seat SaaS bill in a currency your center doesn't earn in.

### Who It's For

Learning centers, coaching institutes, test-prep academies, and training providers that have outgrown spreadsheets but can't justify enterprise LMS licensing — particularly single-branch or few-branch operations that need one admin to run enrollment, fees, and attendance without a dedicated IT budget.

### Origin

Loomis LMS is the first commercial product from **[QongBit](https://github.com/qongBIT)**.

It was built for and is in daily production use at **AIMS English, Chattogram branch**, managing live student enrollment, fee collection, and attendance. Everything center-specific has been replaced with placeholders so the repository can be forked and deployed for any institution — see [Forking & Customization](#forking--customization).

---

## Features

### 👥 Accounts & Roles

Three roles (`student`, `faculty`, `admin`) and three account states (`pending`, `active`, `suspended`), enforced at the database level with `CHECK` constraints rather than in application code.

- **Self-signup with approval gate** — new accounts land in `pending` and cannot sign in until an admin activates them, so a public signup form can't populate your roster with junk
- **Faculty assignment** — each student is assignable to a faculty member; faculty then see only their own students and cannot alter fee discounts, so teaching staff get roster access without financial authority
- **Super admin** — a single account, designated by the `SUPER_ADMIN_EMAIL` environment variable, that can change roles and read the audit log; auto-promoted on first login
- **Suspension** — revokes access immediately without deleting the student's payment or attendance history

### 🎓 Student Dashboard

- **Multi-course enrollment** — a student can hold several concurrent courses; each shows duration, session count, class days and time, and its included perks
- **Fee ledger** — total fee, discount applied, amount paid, outstanding balance, and next payment date
- **Installment plan** — scheduled amounts with due dates, each marked `pending`, `paid`, or `overdue`
- **Attendance record** — per-class history with four states: present, absent, late, excused
- **Announcement banners** — image, video embed, gradient background, and a call-to-action link
- **Broadcast inbox** — notices sent to everyone, to this student specifically, or to their assigned faculty group
- **Academic calendar** — events, holidays, and exam dates
- **Four color themes** — Teal, Indigo, Coral, Emerald; the choice persists per browser
- **Self-service password change** — requires the current password and signs out the account's other sessions

### 🛡️ Admin & Faculty Dashboard

- **Student records** — create, approve, edit, suspend, and search; assign courses, faculty, student ID, class schedule, and discounts
- **Payment collection** — update a student's paid total and the system writes the difference to an immutable payment history automatically; filter collection totals by period
- **Installment scheduling** — build a payment plan per student and track it against actual payments
- **Attendance marking** — pick a course and date, mark the roster in bulk, and correct past records
- **Broadcasts** — rich notifications with images, targeted to all students, one student, or a faculty member's assigned group
- **Announcement management** — create, edit, activate, and delete the banners students see
- **Academic calendar** — add and remove events, holidays, and exam dates
- **External services** — curate the links surfaced on the student dashboard
- **Maintenance mode** — a toggle that swaps the student dashboard for a maintenance notice, without a redeploy
- **Cache control** — force the service worker to purge caches and reload for every visitor, so a fix reaches students immediately
- **Password reset** — admins reset a student's password after verifying identity out of band; all that student's sessions are invalidated

### 👑 Super Admin

- **Role management** — promote or demote any user between student, faculty, and admin
- **Audit log** — an append-only record of every administrative action: student edits, password resets, role changes, announcements, calendar changes, and service edits, each stamped with the acting admin's email, the action, a detail string, the target record, and a timestamp. There is no delete endpoint.
- **Forgot-password queue** — public reset requests land in the audit log as a verification queue instead of emailing a reset link to an unverified address

### 🔐 Security

- **PBKDF2-SHA-256 hashing** — 100,000 iterations, unique per-user salt; legacy SHA-256 hashes verify once and upgrade transparently on next login
- **D1-backed rate limiting** — login is limited per IP *and* email (10 / 15 min); signup (5 / hr), password change (5 / 15 min), forgot-password (5 / hr), and admin reset (10 / 15 min) are limited per IP
- **Fail-closed super admin** — with `SUPER_ADMIN_EMAIL` unset the role simply does not exist; there is no default placeholder for an attacker to claim
- **Same-origin enforcement** — state-changing requests from other origins are rejected
- **HTTP-only session cookies** — with `SameSite`, invalidated across other sessions on password change
- **Account enumeration protection** — login and forgot-password give identical responses whether or not the email exists
- **Security headers** — CSP, `X-Frame-Options`, HSTS, and `Referrer-Policy`, set in [`_headers`](_headers)

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

Issues and pull requests are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run `npm run check` — syntax checks, SQL, HTML, and tests must pass
4. Commit and push: `git push origin feature/my-feature`
5. Open a Pull Request

Please don't commit real contact details, credentials, account identifiers, or student data. Everything center-specific belongs in a placeholder or an environment variable.

---

## License

Licensed under the [GNU General Public License v3.0](LICENSE). You are free to use, modify, and distribute this software, including commercially, provided derivative works remain under the same license.

---

<p align="center">
  Built by <a href="https://github.com/qongBIT">QongBit</a> on <a href="https://pages.cloudflare.com/">Cloudflare Pages</a> + <a href="https://developers.cloudflare.com/d1/">Cloudflare D1</a><br>
  <sub>In production at AIMS English, Chattogram</sub>
</p>
