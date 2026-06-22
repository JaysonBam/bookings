# Google OAuth Verification Readiness

Last updated: 2026-06-22

This app uses Google OAuth only for staff sign-in and identity verification through Supabase Auth. It does not use Gmail, Google Drive, Google Calendar, Google Contacts, or other Google API content.

This document is a technical readiness checklist, not legal advice. The university privacy/data-protection office and appropriate departmental owner should review the OAuth consent screen, privacy policy, terms, and retention language before production submission.

## Public URLs

Replace `https://example.edu` with the verified production domain.

- App homepage/about page: `https://example.edu/about`
- Privacy policy: `https://example.edu/privacy`
- Terms of service: `https://example.edu/terms`
- Staff login: `https://example.edu/login`

The login page links to the app overview, privacy policy, and terms before sign-in.

## Google OAuth Scopes

The app explicitly requests only these identity scopes in `src/pages/login/page.tsx`:

- `openid`
- `email`
- `profile`

No Gmail, Drive, Calendar, Contacts, Admin SDK, or other Google API scopes are requested in the application code. During Google Cloud and Supabase configuration, do not add extra scopes unless a future feature truly requires them and the privacy policy, consent screen, verification path, and user disclosure are updated.

## OAuth Consent Screen Setup

Use a production Google Cloud project for the production app.

Configure the Google Auth Platform/OAuth consent screen with:

- Public app name: `MISC Bookings` or the university-approved production name.
- User support email: a monitored departmental or university support address.
- Developer contact email: a monitored technical/admin address.
- App logo only if approved for use by the university.
- Authorized production domain, verified in Google Search Console if required.
- Homepage URL: `/about` on the production domain.
- Privacy policy URL: `/privacy` on the production domain.
- Terms of service URL: `/terms` on the production domain.
- Scopes/data access: only `openid`, `email`, and `profile`.

If all users are inside the same Google Workspace organization, check whether the project can use an Internal audience. If the app must be External, publish to production and submit for verification if Google requires it.

## Redirect URI Notes

This app uses Supabase Auth as the OAuth broker. Configure redirect URIs in both Google Cloud and Supabase.

In Google Cloud OAuth client settings, include the Supabase Google callback URL for the production Supabase project, typically:

```text
https://<supabase-project-ref>.supabase.co/auth/v1/callback
```

In Supabase Auth URL configuration, include the production app URL and redirect URL used by the app:

```text
https://example.edu/login
```

For local development, use localhost URLs only in development/test OAuth clients, not in the production client.

## Authorized Domains

Add and verify only production domains controlled by the university or department. Do not use URL shorteners or unrelated domains for OAuth app URLs or redirects.

## Data Inventory

### Google Sign-In and Staff Profile Data

Collected from Google/Supabase Auth and stored or used by the app:

- Supabase Auth user ID, which corresponds to the authenticated account in `auth.users`.
- Google account email address.
- Google display name/full name.
- Google profile image/avatar URL.
- Session tokens managed by Supabase Auth.

Stored in `public.profiles`:

- `id`: Supabase Auth user ID, linked to `auth.users`.
- `email`: staff email address and authorization key.
- `full_name`: staff display name.
- `profile_url`: profile image URL.
- `status`: `pending` or `active`.
- `settings`: permission for settings/system configuration.
- `authorisation`: permission for user/access management.
- `analytics`: permission for reporting/analytics.

### Booking and Operational Data

Stored in `public.bookings`:

- Room ID and room name through the related rooms table.
- Course ID or free-text course name.
- Booking date, start time, and end time.
- Student numbers or bulk student count.
- Borrowed room items.
- Staff name entered in `booked_by`.
- Bulk booking ID.
- Booking state: `Active`, `Reserved`, or `Ended`.

Stored in `public.rooms`:

- Room name.
- Minimum and maximum people/capacity values.
- Availability flag.
- Dynamic room labels.
- Borrowable items.

Stored in `public.courses`:

- Course name.
- Course color.

Stored in `public.settings`:

- Operational hour settings.
- Saturday hour settings.
- Testing clock configuration, when enabled.

Stored in `public.logs` when `VITE_LOGGING_ENABLED=true`:

- Event type, such as booking creation or state change.
- Timestamp.
- JSON detail including creation type, rank, whether the staff name was auto-filled or manually entered, state transition, and timing metrics.

Stored in `public.bugs`:

- Bug/feedback description.
- Reporter name.
- Upvote count.
- Status.
- Admin update.

Browser storage:

- `localStorage` key `booking-theme-mode`, used only for light/dark theme preference.
- Supabase Auth may use browser storage/cookies for the signed-in session.

### Data Access

Authorized staff can access booking, room, course, bug, and documentation views. Additional profile flags control access to settings, analytics/reports, and user management. Supabase row-level security policies require authenticated users and profile records for protected data access.

## Verification Checklist

- Confirm the code requests only `openid email profile`.
- Confirm the Google Cloud OAuth consent screen lists only basic identity scopes.
- Confirm no Gmail, Drive, Calendar, Contacts, Admin SDK, or other Google API scopes are configured in Google Cloud or Supabase.
- Confirm `/about`, `/privacy`, and `/terms` are publicly reachable without login.
- Confirm `/login` links to `/about`, `/privacy`, and `/terms` before sign-in.
- Confirm the OAuth consent screen app name matches the public app name.
- Confirm support and developer contact emails are monitored.
- Confirm production domain ownership/verification is complete.
- Confirm authorized redirect URIs match the production Supabase callback URL exactly.
- Confirm Supabase Auth site URL and redirect allow-list include the production app URL.
- Confirm the department has approved the data inventory, retention language, and contact process.

## Internal-Use Notes

This is an internal departmental staff app. Students do not authenticate into the app. If all users are in the same Google Workspace organization, an Internal app audience may reduce or avoid external verification requirements. If any authorized staff users are outside that Workspace organization, the app may need to be External and subject to Google's verification process.

## References

- Google OAuth scopes: https://developers.google.com/identity/protocols/oauth2/scopes
- Google Auth Platform audience: https://support.google.com/cloud/answer/15549945
- Google OAuth clients and redirect URI requirements: https://support.google.com/cloud/answer/15549257
