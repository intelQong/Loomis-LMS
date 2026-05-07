# AIMS English LMS — Cloudflare Pages + D1 Deployment

## Is Cloudflare D1 a good database choice for this LMS?

Yes — for this LMS, Cloudflare D1 is a good choice because the app is being hosted on Cloudflare Pages and needs a lightweight relational database for users, courses, assigned faculty, notifications, sessions, and payment records.

**Why it fits:**
- Pages Functions can access D1 through a Cloudflare binding, so the static dashboard can keep all database access server-side.
- D1 is SQLite-based, which is a natural fit for structured LMS records and simple reporting.
- It removes the need to configure Firebase Auth/Firestore separately.
- It keeps hosting and database operations inside one Cloudflare project.

**Trade-offs:**
- D1 is not a drop-in client-side database; the browser must call Pages Functions under `/api/*`.
- Authentication is custom in this repo now, using an HTTP-only session cookie and hashed passwords in D1.
- For very complex realtime features, you would need polling, WebSockets, Queues, or another realtime layer. This LMS currently uses normal API refreshes instead of Firebase realtime listeners.

---

## Project Structure

```
aims-lms/
├── index.html                ← Login / Signup
├── student-dashboard.html    ← Student portal
├── admin-dashboard.html      ← Admin + faculty dashboard
├── assets/aims-logo.svg      ← Branding logo
├── functions/api/[[path]].js ← Cloudflare Pages Functions API
├── migrations/0001_init.sql  ← D1 schema
├── wrangler.toml             ← Cloudflare D1 binding config
├── styles/
└── js/
```

---

## Step 1: Install Wrangler Locally

```bash
npm create cloudflare@latest -- --help
npm install --save-dev wrangler
npx wrangler login
```

If you do not want to add a `package.json`, you can also run Wrangler directly with `npx wrangler ...`.

---

## Step 2: Create the Cloudflare D1 Database

```bash
npx wrangler d1 create aims_lms
```

Wrangler prints a `database_id`. Copy that ID into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "aims_lms"
database_id = "YOUR_DATABASE_ID_FROM_CLOUDFLARE"
migrations_dir = "migrations"
```

---

## Step 3: Apply the Database Migration

For local development:

```bash
npx wrangler d1 migrations apply aims_lms --local
```

For production Cloudflare D1:

```bash
npx wrangler d1 migrations apply aims_lms --remote
```

---

## Step 4: Create the First Admin Account

1. Open the deployed site or local dev site.
2. Sign up normally.
3. In Cloudflare D1, promote that user to admin:

```bash
npx wrangler d1 execute aims_lms --remote --command "UPDATE users SET role='admin', status='active' WHERE email='YOUR_EMAIL@example.com';"
```

4. Log in again. Admin users are redirected to `admin-dashboard.html`.

---

## Step 5: Create Faculty Accounts and Assign Students

1. Ask the faculty member to sign up normally.
2. Promote that account to faculty:

```bash
npx wrangler d1 execute aims_lms --remote --command "UPDATE users SET role='faculty', status='active' WHERE email='FACULTY_EMAIL@example.com';"
```

3. Find the faculty UID:

```bash
npx wrangler d1 execute aims_lms --remote --command "SELECT id, email FROM users WHERE role='faculty';"
```

4. Admin dashboard → Students → Edit → paste the faculty UID into **Assigned Faculty UID**.
5. Faculty can then log in, see only assigned students, and send notifications to all assigned students or one assigned student.

---

## Step 6: Run Locally

```bash
npx wrangler pages dev . --d1 DB=aims_lms
```

Then open the local URL printed by Wrangler.

---

## Step 7: Deploy to Cloudflare Pages

### Option A: GitHub + Cloudflare Pages Dashboard

1. Push this repository to GitHub.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages.
3. Connect the GitHub repository.
4. Build settings:
   - Framework preset: **None**
   - Build command: leave empty, or use `echo "No build required"`
   - Build output directory: `/` or `.`
5. Deploy.
6. Pages project → Settings → Functions → D1 database bindings.
7. Add binding:
   - Variable name: `DB`
   - D1 database: `aims_lms`
8. Redeploy after adding the binding.

### Option B: Wrangler Direct Deploy

```bash
npx wrangler pages deploy . --project-name aims-lms
```

If this is the first deploy, follow the prompts to create the Pages project. Make sure the production Pages project has the `DB` D1 binding.

---

## Step 8: Add the Custom Domain

1. Cloudflare Dashboard → Workers & Pages → your Pages project.
2. Custom domains → Set up a custom domain.
3. Add `student.aimsctg.online` or your preferred subdomain.
4. Cloudflare will add or suggest the DNS record.
5. Wait until the custom domain status is active.

---

## Admin Quick Reference

| Action | Where |
|---|---|
| Approve student | Students tab → Approve button |
| Update payment | Payments tab → Update Payment |
| Send mass notification | Notifications tab → Send Notification → All Students |
| Send to one student | Notifications → Individual → Select student |
| Assign faculty to student | Students tab → Edit → Assigned Faculty UID |
| Faculty notification | Faculty dashboard → Notifications → All Assigned Students or Assigned Individual Student |
| Suspend student | Students tab → Suspend |
| Edit student details | Students tab → Edit |

---

## Notes

- The API is implemented in `functions/api/[[path]].js` and stores data in D1 through the `DB` binding.
- Sessions use an HTTP-only cookie named `aims_session`.
- Passwords are salted and hashed before storage.
- Do not expose D1 credentials or bypass the Pages Functions API from the browser.
