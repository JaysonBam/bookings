# User access expiry

Branch: `feature/user-access-expiry`, based on production/main `fff1808`.
The database migration was deployed to production Bookings (`droihuwjvkfmgvqflsru`)
on 30 September 2026. The website and main branch have not been deployed or merged.
No authentication settings or Edge functions were changed.

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

Final regression verification (30 September 2026):

- 17 database/logic tests, including applying the migration to populated main
  databases and comparing existing reads, booking CRUD, maintenance, bug votes,
  settings, profile login updates and staff permissions before/after the upgrade.
- 26 browser cases across desktop/mobile, including automatic expiry with no
  interaction, expiry assigned to an already-open Never session, booking CRUD,
  desktop search, maintenance, bug reporting/votes and protected routes.
- 26 unchanged page/navigation views compared with main: identical rendered text
  and screenshots on desktop/mobile. Access Management is the intended UI change.
- Production build passes. Full ESLint has existing main violations; the branch
  introduces no new lint errors. Runtime dependencies and deployment settings are unchanged.

The existing narrow mobile booking toolbar can clip Search outside the viewport;
that behaviour also exists on main and is unchanged. Browser search coverage uses
desktop; booking creation, updates and deletion are checked on both sizes.
Temporary demo/comparison scripts, sample data, screenshots and reports are outside
the feature commit. Only permanent tests and this verification summary are included.

Production database verification passed before and after deployment using rollback
transactions: all nine existing users retain permanent access, reads across all seven
tables and existing staff permissions are preserved, expired reads/writes are denied,
and staff duration/deactivation/reactivation controls work. Existing policies and the
production permission safeguard remain unchanged; table counts are unchanged and no
verification data was retained. The live PostgREST gateway recognizes the new column
and RPCs and rejects anonymous expiry changes.

Hosted Google OAuth and Supabase Realtime were not exercised during deployment.
The web build remains pending in the PR. No scheduled cleanup, new authentication
provider, Edge function, or Auth setting is required.
