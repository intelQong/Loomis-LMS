# Learning Portal — Cloudflare Pages + D1 Deployment

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

## No-PC Setup: Use GitHub + Cloudflare Dashboards

If you only have a phone or tablet, you can still deploy this project without installing anything locally:

1. Upload or push this repository to GitHub.
2. In GitHub, open the repository → **Settings** → **Secrets and variables** → **Actions**.
3. Add these repository secrets:
   - `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with Pages and D1 edit permissions.
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
4. Open **Actions** → **Cloudflare D1 Setup** → **Run workflow**.
5. Choose `create_database=true` the first time to create `aims_lms`.
6. Run the same workflow with `apply_migrations=true` to create the tables.
7. After you sign up on the live site, run the workflow again and enter your email in `promote_admin_email` to make yourself an active admin.
8. Open **Actions** → **Deploy Cloudflare Pages** → **Run workflow** to deploy the site.
9. In Cloudflare Pages → your project → Settings → Functions → D1 database bindings, add:
   - Variable name: `DB`
   - Database: `aims_lms`
10. Redeploy once after adding the binding.

The repository includes `.github/workflows/` for CI, D1 setup, and Cloudflare Pages deployment so you do not need a local PC.

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

Wrangler prints a `database_id`. For dashboard-based deployment, you do not need to edit `wrangler.toml`; add the D1 binding in Cloudflare Pages settings instead. If you later deploy locally using Wrangler config, uncomment the D1 block in `wrangler.toml` and paste the real `database_id`.

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

## Troubleshooting: GitHub Action says Wrangler is missing

If a deploy log shows an error like `npx canceled due to missing packages` or `Wrangler not found or version is incompatible`, rerun the latest workflow from this repository. The workflows intentionally call Wrangler directly with:

```bash
npx --yes wrangler@4 ...
```

The `--yes` flag allows GitHub Actions to install Wrangler non-interactively, which is required when running from a phone or tablet.

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
