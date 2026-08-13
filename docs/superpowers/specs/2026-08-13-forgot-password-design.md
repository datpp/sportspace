# Forgot Password (FR-P01) — Design

## Goal

FR-P01 covers register/login (already shipped) and password reset (not shipped — `AuthController` has only `POST /register`/`POST /login`). This design adds a real email-based reset flow: the user requested actual SMTP email delivery (testable by resetting a `*@mailinator.com` address and checking its public inbox), not a mocked/console-only token flow.

## Architecture

- New dependency `nodemailer` (+ `@types/nodemailer`). A new `mail` module (mirrors `notification` module's shape): `MailModule`, `MailService` wrapping a `nodemailer` SMTP transport configured entirely from env vars — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (added to `.env.example`; generic, so the user can point these at Gmail SMTP, Mailtrap, SendGrid's SMTP relay, or anything else — this design doesn't hardcode a provider). `MailService.sendPasswordResetEmail(to: string, resetLink: string): Promise<void>`.
- `User` gains two nullable columns: `resetPasswordTokenHash: string | null`, `resetPasswordExpiresAt: Date | null` — the raw token is **never stored**, only its hash (bcrypt or a simple SHA-256, matching the existing "never store the plaintext secret" principle already applied to `passwordHash`), migration required.
- `AuthController` gains:
  - `POST /auth/forgot-password` (body: `{ email }`) — looks up the user; **always returns 200 regardless of whether the email exists** (prevents user-enumeration via response-timing/content). If the user exists: generate a random token (`crypto.randomBytes(32).toString('hex')`), hash it, store the hash + a 30-minute expiry on the user row, and call `MailService.sendPasswordResetEmail` with a link to `${WEB_URL}/reset-password?token=<raw-token>`. `WEB_URL` is a new env var (the backend needs to know the web app's origin to build this link — currently nothing in `apps/backend` knows about the web app's URL at all).
  - `POST /auth/reset-password` (body: `{ token, newPassword }`) — hashes the incoming token, looks up a user whose `resetPasswordTokenHash` matches AND `resetPasswordExpiresAt > now()`; if found, updates `passwordHash` (bcrypt, same as register) and clears both reset columns (single-use token); if not found/expired, `BadRequestException` ("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn").
- The reset link always points at a **web page**, even when the request originates from mobile — this codebase has no RN deep-link/universal-link configuration, and building that is out of scope for this gap. Mobile's forgot-password screen only calls `POST /auth/forgot-password` and shows "kiểm tra email của bạn"; the actual reset happens in a browser.

## Web

New page `apps/web/src/app/(auth)/forgot-password/page.tsx` (or wherever the existing login page lives — mirror its layout) with an email form calling a new server action hitting `POST /auth/forgot-password`, and `apps/web/src/app/(auth)/reset-password/page.tsx` reading `?token=` from the URL, a new-password form calling `POST /auth/reset-password`, redirecting to `/login` on success.

## Mobile

`LoginScreen` (or wherever it lives) gains a "Quên mật khẩu?" link to a new `ForgotPasswordScreen` — an email input + submit, showing a static "kiểm tra email của bạn" success message (no token entry on mobile; that happens on the web page from the emailed link).

## Testing

- Unit: `AuthService`'s new methods with `MailService` mocked via `createMock<MailService>()` (CLAUDE.md §0.3 — no real SMTP in unit tests) — forgot-password with an existing email calls `sendPasswordResetEmail` and stores a hashed token; forgot-password with a non-existent email still returns success and does **not** call `sendMail`; reset-password with a valid unexpired token updates the password and clears the token fields; reset-password with an expired or wrong token throws `BadRequestException`.
- e2e: override `MailService` with a test double in the Nest testing module (standard DI override, not real SMTP — matches how other e2e specs avoid hitting real external services) that captures the call args, so the e2e can assert the actual reset link/token round-trips correctly through a real HTTP request → real DB write → real second HTTP request, without needing live SMTP credentials in CI. A genuine manual test against a live `*@mailinator.com` inbox is documented as a manual verification step in the plan, not an automated test.

## Out of scope

- No rate-limiting on `/auth/forgot-password` beyond what already exists globally (not asked for; note as a possible follow-up, don't build it here).
- No "resend" cooldown UI polish beyond the basic success message.
