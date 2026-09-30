# User access expiry

Branch: `feature/user-access-expiry`, based on production/main `fff1808`.
This feature has not been deployed. No hosted database or authentication settings
were changed during development.

## Behaviour

- Existing Google sign-in and normal profiles are used.
- The only new column is `profiles.access_expires_at` (`timestamptz`, nullable).
  NULL means Never. Existing users receive NULL without a data rewrite.
- Adding a user defaults to Never, with 8 hours, 24 hours and 7 days available.
  Durations start at the database server's current time when saved.
- Deactivate sets expiry to now. Expired/deactivated users remain in the collapsed
  inactive section. Activate asks for a new duration and preserves identity and permissions.
- Delete removes the allow-list profile, as before; it does not delete the Google account.
- Only currently unexpired Access Control staff may manage user access. Ordinary
  users can still update login identity details but cannot change expiry or permissions.
- Database policies check current profile/expiry on every protected read and write,
  including requests with JWTs issued before expiry/deactivation. Expired writes
  return an explicit access-denied error. Bug upvotes use the same check.
- The layout checks access on navigation, focus, once per minute, and at a known
  expiry deadline. The backend blocks requests immediately even before the screen closes.
- Labels show minutes/hours/days when the access page renders; there is no live countdown.
  Desktop expiry labels have a tooltip with the exact date/time.

The existing HexForge collection and access functions read the booking profile
using the caller's booking token. The profile RLS guard returns no row for expired
callers, so those backend checks also reject them. No HexForge source changes are needed.
Independent access granted for signing directly into HexForge remains separate.

## Local verification

Use Node 24 and `npm ci`, then:

```sh
npm test
npm run test:browser
npm run build
```

The database tests apply the complete repository migration history in local PGlite
PostgreSQL with Supabase-style roles/JWT claims. Browser tests use those same
database rules on desktop and mobile, with simulated Auth/HTTP/HexForge responses.
All non-app HTTP/WebSocket traffic is intercepted; the test server uses dummy local
service URLs rather than `.env` services. The tests do not call production.

Browser tests use installed Microsoft Edge by default. Set
`BOOKINGS_TEST_BROWSER_CHANNEL=chrome` to use installed Chrome instead.
Screenshots and generated reports remain ignored by Git.

Hosted Google OAuth, the deployed PostgREST gateway, and Supabase Realtime have not
been tested against this migration. Before any future production rollout, verify
those integrations on an isolated Supabase project with separate browser profiles
for staff and users. Apply the migration before deploying the web build. No scheduled
cleanup, new authentication provider, Edge function, or Auth setting is required.
