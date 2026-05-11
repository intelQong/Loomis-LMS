# AIMS LMS Security Audit

_Last updated: 2026-05-11_

## Scope

Reviewed the Cloudflare Pages Function API, static dashboard clients, session handling, password reset flows, and response headers in this repository.

## Findings and mitigations implemented

| Area | Risk | Mitigation in this change |
| --- | --- | --- |
| Self-service password reset | Students/admins could not change their own password while logged in. Admin-only student resets existed, but there was no current-password verification flow for the account owner. | Added authenticated `POST /api/auth/change-password`, requiring the current password, a new password of at least 8 characters, and confirmation in the UI. Other sessions for that user are revoked after the change. |
| Password storage | New and reset passwords were stored as a single SHA-256 hash with a salt, which is too fast for password storage. | New passwords now use PBKDF2-SHA-256 with 100,000 iterations. Legacy hashes still verify, then upgrade automatically on successful login. |
| Brute-force attempts | Login, signup, and password-reset endpoints did not have application-level rate limiting. | Added D1-backed rate limits for login, signup, self password changes, and admin password resets. |
| Cross-site form/API abuse | Cookie-authenticated unsafe requests could be attempted cross-site. | Added same-origin enforcement for `POST`, `PUT`, `PATCH`, and `DELETE` requests using `Origin` and `Sec-Fetch-Site` headers. |
| Account enumeration | Login told users whether an email existed. | Login now returns a generic `Invalid email or password.` for bad credentials. |
| Response/browser hardening | Security headers were incomplete. | Added `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and a restrictive CSP in `_headers`, while preserving approved video iframe sources for the student dashboard. |
| Session exposure after password change | Password reset only invalidated student sessions for admin resets. | Self-service password change invalidates all other sessions for the same account while keeping the current session active. Admin student reset still invalidates all sessions for the student. |

## Cloudflare challenge recommendation

Cloudflare Turnstile or a Cloudflare WAF Managed Challenge should be enabled if production logs show repeated automated abuse after the rate limits above. Recommended rules:

1. Managed Challenge for high-rate `POST /api/auth/login` and `POST /api/auth/signup` traffic.
2. Managed Challenge or block for requests to `/api/*` with a cross-site `Sec-Fetch-Site` value.
3. Bot Fight Mode / Super Bot Fight Mode if available on the Cloudflare plan.

The application now has server-side rate limiting, so CAPTCHA is not required for normal users unless traffic indicates active abuse.

## Remaining recommendations

- Rotate any known shared/default passwords after deploying this change.
- Run D1 migrations consistently during deployment; runtime compatibility helpers reduce breakage but migrations should remain the source of truth.
- Consider adding email-based forgot-password tokens if an email service is added later. Do not implement unauthenticated password reset without verified email ownership.
