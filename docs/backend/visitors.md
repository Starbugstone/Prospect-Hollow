# Public profiles and live town visitors

Shared-town visits have live presence and an owner-only guestbook. They are
independent of playable saves, normal VIP arrivals, population, transport and
saloon collection. No visit affects puzzle moves, rewards or progression.

## Player workflow

An account's public profile contains an optional display name and a default
“Visiting as” town. Display names pass the public-name moderation filter. When
visiting, the selected town provides the “Mayor of …” subtitle and clothing era.
A town need not be shared to supply this identity, but only a shared town gets a
return-visit link. The visitor controls this choice separately from town naming.

A visitor without a display name appears as “Mayor of [town]”, or “Visitor” if
there is no usable home town. Signed-out visitors appear as “Visitor” and wear
the host town's current era. Players without a usable home town also use the
host era. Visitors from other eras retain their home town's dress style.

The host sees live visitor characters at valid walking positions without a
transport arrival. They have a distinct visitor accessory and do not consume
ordinary visitor capacity. The guestbook lists people here now and visit
history, with arrival/departure times and duration. History includes visits made
while the host was offline. Returning from a puzzle shows whoever is still
present; visits never interrupt a puzzle.

## Presence lifecycle

The visit page sends a heartbeat immediately and every 12 seconds. The visible
host checks visitors every 3 seconds. Normal arrivals/departures therefore
appear within a few seconds plus network latency; this implementation does not
use a persistent push connection.

Each tab has an unpredictable 256-bit token and a sequence counter. A presence
lease lasts 45 seconds from the last successful heartbeat. Leaving ends the
lease; a late heartbeat cannot revive it. Browser closure or a connection loss
that prevents departure is handled by lease expiry. A hidden visit page stops
heartbeats and leaves after a 15-second grace period, then starts a new stay
when visible again. Requests back off after errors.

Multiple tabs share one visit per signed-in account and destination town.
Signed-out tabs deduplicate with a random browser token in local storage; this
is browser identity, not proof of a unique person. Closing one tab does not
remove a visitor whose other tab is still active. Hosts never appear as their
own guest. Refreshes and brief reconnects during an active lease reuse the visit.

Names, town names and clothing eras are snapshotted when a visit starts. A later
rename or era advancement does not rewrite history. A return link is evaluated
when read and disappears if its source town becomes private or is deleted.

## API and data

The API contract is in [openapi.yaml](openapi.yaml):

- `GET /api/v1/account/profile`: public profile and owned town choices; signed
  out returns a null profile and no towns.
- `PATCH /api/v1/account/profile`: save `displayName` and `visitingTownId`.
- `POST /api/v1/villages/{publicId}/presence`: join or renew using `token`,
  `sequence`, optional `browserToken` and optional owned `townId`.
- `DELETE /api/v1/villages/{publicId}/presence`: end the tab's `token` lease,
  including its latest `sequence`.
- `GET /api/v1/towns/{townId}/visitors?page=1`: owner-only current presence plus
  20 history entries per page, newest first. All timestamps use Unix milliseconds.

The `present` entry's `era: null` means that the renderer should use the host's
current era. A history entry retains its arrival era. Presence endpoints expose
no account IDs, emails, private home town UUIDs, or raw tokens to hosts.

Migration 14 adds `player_profiles`, `visitor_visits` and `visitor_leases` and
clears the obsolete `town_guests` queue. GET public appearance endpoints no
longer enqueue a delayed VIP. Ordinary random VIPs and saloon help remain
separate. Apply the migration before serving this client; release health checks
require the latest registered schema.

History has no automatic retention cutoff in this version. It is paginated and
removed by cascading deletion when the host town is physically removed. Public
profile rows are deleted with their account. Deleting an origin town removes
its relational link but retains the visit's name/era snapshot in the host's
history. Presence tokens are stored as keyed hashes, never raw browser tokens.

The shared-town row lock serializes joins, departures, expiry and owner reads.
Origin validation, signed-in mutation CSRF checks and per-IP rate limits apply.
Departure additionally uses the unguessable lease token, so logout does not
prevent a tab from closing its own lease. Unpublishing stops new arrivals and
closes active visits on the next presence/owner read.
