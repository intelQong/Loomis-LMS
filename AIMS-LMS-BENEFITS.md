# AIMS LMS — Admin Problems Mitigated and Student Benefits

## Purpose

AIMS LMS is designed to centralize student administration, communication, payment tracking, academic notices, and student self-service into one Cloudflare-hosted learning management system. The project reduces manual coordination for admins while giving students a single dashboard for course, payment, announcement, and support information.

## Problems the LMS Mitigates for Admins

### 1. Scattered student records

**Problem:** Student information can become split across spreadsheets, chat apps, paper forms, and individual staff devices. This makes it difficult to know who is active, pending, suspended, assigned to faculty, or due for follow-up.

**How AIMS LMS mitigates it:**

- Keeps student profile information in one database-backed system.
- Supports student statuses such as pending, active, and suspended.
- Stores course, phone, student ID, enrolled date, class days, class time, assigned faculty, payment totals, and next payment date.
- Lets admins create students directly or approve signups from the dashboard.

### 2. Delayed approval and onboarding

**Problem:** New student registrations can be missed or delayed when approvals are handled manually.

**How AIMS LMS mitigates it:**

- Shows pending student registrations in the admin dashboard.
- Gives admins quick actions to approve, edit, suspend, or manage a student.
- Reduces the risk of a student being forgotten after signup.

### 3. Weak visibility into payments and dues

**Problem:** Fee collection often requires manual checking across payment notes, messages, and spreadsheets. Admins may not quickly know who paid, who is due, or when the next installment is expected.

**How AIMS LMS mitigates it:**

- Tracks total paid, discount, total due, next payment date, and installment plans.
- Shows financial insight cards for total collected and due collection.
- Keeps payment history connected to each student.
- Helps admins prioritize follow-up for unpaid or upcoming dues.

### 4. Inefficient broadcast communication

**Problem:** Sending the same message repeatedly through multiple channels can lead to inconsistent announcements and missed students.

**How AIMS LMS mitigates it:**

- Provides broadcast tools for admins and faculty.
- Supports announcements with text, images, links, and approved video embeds.
- Allows messages to target all students, individual students, or assigned groups.
- Gives students a dedicated Broadcasts area instead of relying only on chat history.

### 5. Faculty assignment confusion

**Problem:** Faculty may not always know which students are assigned to them, and admins may struggle to limit faculty access appropriately.

**How AIMS LMS mitigates it:**

- Stores assigned faculty for each student.
- Allows faculty dashboard access to assigned students only.
- Restricts faculty messaging so they cannot notify students outside their assignment.
- Helps protect student privacy while keeping faculty informed.

### 6. Lack of audit history for administrative actions

**Problem:** Without logs, it is difficult to know who changed a student record, reset a password, changed a role, deleted an item, or handled a security-related request.

**How AIMS LMS mitigates it:**

- Maintains system audit logs for administrative actions.
- Records meaningful details for student updates, password reset requests, role changes, announcements, services, and calendar changes.
- Helps super admins review changes and investigate mistakes or misuse.

### 7. Password reset and account support bottlenecks

**Problem:** Students may forget passwords, while admins need a safe way to help without exposing accounts to unauthorized resets.

**How AIMS LMS mitigates it:**

- Provides authenticated self-service password changes for logged-in users.
- Provides a forgot-password request modal that notifies admins without revealing whether an email exists.
- Lets admins reset student passwords after verifying identity.
- Invalidates relevant sessions after password changes/resets.

### 8. Security and abuse risks

**Problem:** Public login/signup forms and cookie-based sessions can be targets for brute-force attacks, cross-site abuse, iframe abuse, and weak password storage.

**How AIMS LMS mitigates it:**

- Uses PBKDF2 password hashing for new and reset passwords.
- Rate-limits login, signup, forgot-password, password-change, and admin reset attempts.
- Enforces same-origin checks on unsafe API methods.
- Adds browser security headers and content security policies.
- Limits announcement video embeds to HTTPS iframe sources and rejects invalid/non-embed inputs.

### 9. Outdated browser cache after deployments

**Problem:** Students and admins may continue seeing old files after an update, causing confusion or broken behavior.

**How AIMS LMS mitigates it:**

- Includes service worker cache controls and dashboard cache-clearing tools.
- Uses asset version query strings to force browsers to fetch updated scripts and styles.

## How the LMS Helps Students

### 1. One place for course information

Students can view their course details, enrollment status, class timing, validity information, and assigned learning information from a single dashboard. This reduces confusion about schedules and course status.

### 2. Easier payment awareness

Students can see payment history, dues, installment dates, and fee information without repeatedly asking the office. This helps them plan payments and reduces missed deadlines.

### 3. Faster access to announcements

Students get a dedicated area for broadcasts and announcements, including rich banners with images, links, and approved video content. Important updates are easier to find than in a busy messaging group.

### 4. Better communication with AIMS

The student dashboard includes contact and service sections so students can quickly find support channels, office details, maps, and related AIMS services.

### 5. Improved account control

Students can change their own password while logged in and can request password help from the login page if they forget it. This reduces downtime when they cannot access their dashboard.

### 6. Personalized dashboard experience

Students can use display settings such as theme colors, giving the portal a more comfortable and personalized feel.

### 7. More transparent learning journey

By combining course, payment, announcement, calendar, and service information in one portal, students have a clearer view of their relationship with AIMS and what actions they need to take next.

## Overall Operational Impact

AIMS LMS helps admins move from manual, scattered processes to a centralized workflow. It helps students move from asking for information repeatedly to checking a self-service dashboard. Together, this reduces administrative workload, improves communication consistency, strengthens account security, and creates a more professional student experience.

## Recommended Next Steps

1. Keep D1 migrations applied in production after every release.
2. Train admins to use audit logs when reviewing sensitive changes.
3. Use the forgot-password audit entries as a verification queue before resetting student passwords.
4. Encourage students to check the dashboard regularly for broadcasts, payments, and calendar updates.
5. Consider adding email/SMS delivery later for automated reset links and announcement notifications.
