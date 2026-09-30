# Temporary access codes

Access Control staff sign in with their approved Google account and generate a
code under **Manage Users → Temporary access**. They enter a name and choose a
duration (1 hour, 8 hours, 24 hours or 7 days). The full code is shown once.
Each code creates a real Supabase Auth user ID, separate from staff profiles.

Users enter only the code on the login page. The same code can be used on multiple
devices concurrently; all those sessions share the same identity. Signing out
affects the current device. Expiry or staff removal blocks subsequent protected
requests on every device, including requests using previously issued tokens.
Bookings, maintenance labels, bug reporting and help are available. Collections,
user management, settings changes and analytics are unavailable.

## Try it locally

From the `bookings` directory, run `npm run demo:access` using Node.js 24.
Open http://127.0.0.1:5175/__demo and click **Open as test Access Control staff**.
Generate a code under **Temporary access**, then open
http://127.0.0.1:5175/login in a private window and enter the code. You can try
bookings, maintenance and bug reporting, then remove the code in the staff window
and check that the temporary window loses access within 15 seconds (or on focus).

Ordinary tabs in the same browser share their Supabase login. Signing in as staff
can therefore switch another ordinary tab to the staff account. Use a separate
private window or a different browser for the temporary user; staff should remain
in the normal window. Creating a second ordinary window is not sufficient.

This uses the local test database and simulated Auth; it does not contact the real
Supabase or HexForge projects. No real Google login is needed for this demo.
Data is held in memory and clears when the demo restarts. Press Ctrl+C in the
terminal to stop it. Keep the demo bound to this computer's loopback interface.

## Deployment

The frontend needs the SQL migration and Edge Function before code login works.
The new controls are not a substitute for deploying the backend.

1. Review the target project and pending migrations with `supabase migration list`.
   Apply `20260930100000_temporary_access_codes.sql` after the existing migrations,
   including profile permission protection. Do not apply unrelated pending
   working-tree changes without reviewing them. Normal deployment uses
   `supabase db push` against the intended linked project.
2. Deploy `supabase functions deploy temporary-access --no-verify-jwt`.
   The public login route verifies the code. Code creation separately verifies
   the caller with Auth and checks the current Access Control permission.
   Required `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` are the standard Edge runtime variables.
   Never put the service role key in a `VITE_` variable.
3. In hosted Auth settings, keep Google sign-in and **Email sign-in enabled**,
   with **Confirm Email enabled**. Admin-created temporary users use Email
   password sign-in internally and are confirmed by the server; users never
   enter an email or password. Local `auth.email.enable_signup` is true because
   disabling the Email provider also disables password login. Keep new-user
   signups enabled for the existing first Google login of pre-approved staff.
   Email-only accounts cannot read/adopt staff profiles or obtain app access;
   the database requires a Google identity or a server-created temporary grant.
   See [Supabase's password login provider check](https://github.com/supabase/auth/blob/master/internal/api/token.go)
   and [general Auth configuration](https://supabase.com/docs/guides/auth/general-configuration).
   Do not push the whole local Auth config to production: local redirect URLs
   are not production URLs.
   Allow multiple sessions per Auth user so the same code can work on several
   devices; a hosted single-session restriction would prevent that behavior.
4. Check regular staff Auth records have the trusted `providers` array containing
   `google`, and active profiles have their correct Auth user ID. Pending Google
   users still activate their pre-approved profile through the existing login.
5. Deploy the frontend, then perform a hosted smoke test with an Access Control
   account, a regular account and a temporary code. Verify creation, two separate
   logins, removal while logged in, expiry, direct Collections denial and the
   existing Google flow. Verify the deployed Realtime/publication behavior too;
   provider services are simulated in the local browser tests.

## Security behavior

- Codes contain 26 cryptographically random base32 symbols (130 random bits).
  Hyphens, whitespace and letter case are normalized. Short PINs are rejected.
- Only a SHA-256 code hash is stored in a private schema. The separate Auth
  credential is derived with a distinct domain prefix and hashed by Supabase
  Auth. Neither that credential nor the full code is returned by list APIs.
- The private table stores immutable identity association, expiry and revocation
  metadata. Removed records remain as tombstones; they cannot fall back to staff
  access. Temporary identity classification uses trusted Auth application
  metadata as well as the grant record, never editable user metadata.
- Temporary accounts cannot read or acquire staff profiles, even if their Auth
  email changes. The existing Collections backend requires such a staff profile
  and therefore rejects temporary accounts without a new collections flow.
- Every protected read/write uses database time and current access state. The
  booking app's testing clock cannot prolong access. Login checks again after
  issuing a session, covering revocation during login. Denied sessions are not
  returned. Refresh tokens cannot bypass the database access checks.
- Rate limits use atomic database counters across Edge instances: 30 attempts per
  IP bucket, 20 per code and 300 globally in a 5-minute window. Unknown/malformed
  codes are also limited. IPs are hashed, and code/global limits do not depend on
  caller-supplied IP headers. Missing rate-limit storage fails closed.
- Codes and sessions use POST bodies and no-store responses. The Edge handler
  does not log bodies, codes, passwords, session tokens or provider error bodies.
- Protected booking mutations record the authenticated actor UUID in
  `private.access_audit`; a manually entered booking display name is not used as
  proof of identity. Code generation, login and revocation are audited too.
- Temporary clients poll protected reads every 15 seconds and revalidate on
  focus and at expiry. Revocation blocks server access immediately; the UI may
  take up to 15 seconds to clear. Previously downloaded data cannot be recalled.
  Temporary clients do not create Realtime subscriptions. Supabase's behavior
  for direct Postgres DELETE subscriptions can expose primary-key notifications
  independently of RLS; validate/disable DELETE publication if strict suppression
  of even deletion metadata is required. This is a provider streaming boundary,
  not a bypass for reading booking rows or making writes.

A shared code cannot identify the individual person using it. Anyone who obtains
a valid code can use it, so separate codes and short durations are preferable.

## Verification

Use Node.js 24 for the TypeScript test runner.

```sh
npm test
npm run test:edge
npm run test:browser
npm run lint
npm run build
```

The database tests execute the actual schema and migration in embedded PostgreSQL
(PGlite), using authenticated, anonymous and service roles with JWT claim context.
They test allow/deny behavior, live-session expiry and revocation, identity
isolation, privilege escalation, audit attribution, migration reapplication and
shared rate limits. Edge tests cover malformed input, cleanup, concurrent logins,
revocation races, fail-closed behavior and provider request contracts.

Playwright runs the real frontend and production Edge handler with PostgreSQL
behind a local Auth/PostgREST simulator, on desktop and mobile viewports. No tests
contact the real Supabase or HexForge projects. Headless Microsoft Edge must be
available, or change the Playwright channel to an installed Chromium browser.
To keep a running manual demo intact, set `BOOKINGS_TEST_API_PORT=55440` and
`BOOKINGS_TEST_SITE_PORT=5176` in the test process environment. Browser tests then
use separate servers, database contents and preview assets.

These tests do not claim to exercise the hosted Auth server, Edge gateway or
Realtime service; the hosted smoke test above remains required after deployment.
