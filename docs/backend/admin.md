# Admin panel

`/admin` is a separate page for the people who run Prospect Hollow. It lists player accounts and their emails, shows each player's towns (rendered like a share link), campaign progress, last connection and statistics, and offers a few audited support and moderation actions. Each environment has its own database, so preprod and production have separate admin accounts.

## First admin and recovery

Admins are never created from the game. Create the first one on the server, from the release directory whose `.env.local` points at the right database:

```bash
/ABSOLUTE/PATH/TO/php /home/CPANEL_USER/apps/prospect-hollow-production/current/bin/admin.php create USERNAME
```

It prints a temporary password once. Sign in at `https://HOST/admin`, replace the temporary password (12 characters or more), then scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Aegis, …) and confirm a 6-digit code. From then on every sign-in needs the password and a code.

The same command recovers a locked-out admin or lists accounts: `list`, `reset-password USERNAME` (new temporary password), `reset-authenticator USERNAME` (set up a new phone at the next sign-in) and `delete USERNAME`. The panel cannot delete its last admin; the server command can.

All admins are equal. Any admin can add another (the panel shows the new temporary password once, to send privately), reset another admin's password or authenticator, or remove them. Nobody resets or removes themselves from the panel; use **Change my password** for your own account.

## What the panel shows

- **Overview**: player totals, players online (seen in the last 5 minutes), active today/7/30 days, live sessions, towns (shared, awaiting purge), web vs app, daily active players and new accounts for 30 UTC days, towns by era and campaign progress.
- **Players**: search by email or player ID, sorted by last seen, newest or email. A player page shows sign-up date, last connection and sign-in, number of email sign-ins, active days in the last 30, last device type, IP address and browser, live sessions and every town (including deleted ones kept for 30 days).
- **Towns**: search by name, owner email or ID; filter all, shared or deleted. A town page renders the town with the share page's read-only renderer, even for private towns, and lists era, coins, levels and stars, buildings, inventory, the five kept cloud revisions and the full save (viewable and downloadable as JSON). Looking at a town never collects its saloon or makes the admin its guest.
- **Activity log**: every admin sign-in, failed sign-in against a real admin, and change. A deleted player appears by ID only.

**Hide emails** masks addresses (`p•••@example.com`) for screen sharing; the choice is remembered on that device.

## Actions

| Action              | Effect                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign out everywhere | Ends every session and unused sign-in link of the player. Towns are untouched.                                                                                                                                                     |
| Delete account      | Type the player's email. Deletes the account, its cloud towns, history and activity immediately. Copies on the player's devices stay there.                                                                                        |
| Rename town         | Same name rules as the owner: 3–24 characters, unique in the account, and moderated when the town is shared. The share link keeps working.                                                                                         |
| Stop sharing        | Closes the share link and removes the town from the public list. The owner can share it again. Admins never publish a town.                                                                                                        |
| Delete town         | Type the town name. Same as the owner deleting it: the slot frees at once and the town is purged after 30 days.                                                                                                                    |
| Restore revision    | Saves a kept revision as a new revision. The replaced save stays in the history. The owner's device takes it on its next sync, or asks which copy to keep if it has unsynced progress, exactly as after playing on another device. |

Renames and unsharing do not change the gameplay revision, so they never conflict with a device's pending progress. None of these actions changes rewards, move rules or campaign progress.

## Player activity recorded

Every signed-in API request records, at most once a minute per player: the last-seen time (minute precision), the last IP address and browser user agent (only the latest, printable characters, 255 at most), and whether it came from the web or the mobile app. Email sign-ins also record their time and count. One row per active UTC day feeds the daily chart and is kept for 90 days. Everything is deleted with the account. The IP address and user agent are personal data: mention them in the privacy notice. Recording never blocks a request; a failure is logged without details.

## Security

- Admin accounts are separate from player accounts. Passwords are hashed with Argon2id (bcrypt where the host lacks it) and must be 12–256 characters without the username. The panel only accepts same-origin browser requests: no native app origin or bearer token.
- Sign-in is staged on one short session: password, then the authenticator code, then any required password change and authenticator enrollment. Only a finished sign-in can read player data. Authenticator codes are RFC 6238 (SHA-1, 6 digits, 30 seconds, one step of clock drift); a code cannot be reused. Five wrong codes end the attempt.
- Authenticator secrets are encrypted (AES-256-GCM) with a key derived from `APP_SECRET`. Changing `APP_SECRET` therefore also requires `reset-authenticator` for every admin, in addition to signing players out.
- The session cookie is `__Host-cascade-admin` on HTTPS (HttpOnly, SameSite Strict, browser session only). Sessions end after one hour idle or 12 hours, and unfinished sign-ins after 10 minutes. Changes need the session CSRF token. Resetting an admin's password or authenticator signs them out.
- Sign-in attempts are limited per IP address (10 per 15 minutes) and per username (20 per 15 minutes); codes per admin (10 per 15 minutes); all admin requests per IP (300 per minute). A burst of failures can briefly lock the real admin out too; wait 15 minutes or reset from the server.
- `/admin` and `/api/admin/*` send `noindex` and `no-store`. `php bin/cleanup.php` removes expired admin sessions and old activity days.

## API

All routes are under `/api/admin/`, JSON only. Changes send `X-CSRF-Token`.

| Route                                                                                                                                        | Purpose                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `POST login` `{username,password}`                                                                                                           | Starts a sign-in; returns `stage` and `csrf`.                     |
| `POST login/code` `{code}`                                                                                                                   | Authenticator code (`totp` stage).                                |
| `GET login/authenticator`, `POST login/authenticator` `{code}`                                                                               | Enrollment secret and link, then confirmation (`enroll` stage).   |
| `POST password` `{current?,password}`                                                                                                        | Required change (`change` stage) or own change (needs `current`). |
| `GET me`, `POST logout`                                                                                                                      | Session and CSRF after a reload; sign out.                        |
| `GET stats`                                                                                                                                  | Overview figures.                                                 |
| `GET players?q=&sort=seen\|created\|email&page=`                                                                                             | Player list, 25 per page.                                         |
| `GET players/{id}`, `POST players/{id}/sign-out`, `DELETE players/{id}` `{confirmation}`                                                     | Player page and actions.                                          |
| `GET towns?q=&filter=live\|public\|deleted&page=`                                                                                            | Town list.                                                        |
| `GET towns/{id}`, `PATCH towns/{id}` `{name?,isPublic:false?}`, `DELETE towns/{id}` `{confirmation}`, `POST towns/{id}/restore` `{revision}` | Town page and moderation.                                         |
| `GET admins`, `POST admins` `{username}`, `POST admins/{id}/reset-password`, `POST admins/{id}/reset-authenticator`, `DELETE admins/{id}`    | Admin accounts.                                                   |
| `GET audit?page=`                                                                                                                            | Activity log, 50 per page.                                        |

`backend/tests/admin.php` covers the sign-in stages, limits, origin and CSRF checks, activity recording, every action and the server command on PostgreSQL and MySQL; `testing/admin-panel.test.js` covers the panel's client.
