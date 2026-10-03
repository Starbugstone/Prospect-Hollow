# Public profiles and live town visitors

Shared-town visits have live presence and a public guestbook for shared towns. They are
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

The host and visitors see all live visitor characters at valid walking positions without a
transport arrival. They have a distinct visitor accessory and do not consume
ordinary visitor capacity. The guestbook lists people here now and visit
history, with arrival/departure times and duration. History includes visits made
while the host was offline. Returning from a puzzle shows whoever is still
present; visits never interrupt a puzzle. While the town view is active, small
notices announce each new arrival and departure by public visitor name. Notices
queue for six seconds each and can be dismissed. Opening or returning to a town
establishes a fresh baseline without replaying earlier arrivals; entering the
mine or switching towns clears the queue. Failed requests never generate
departure notices or duplicate arrivals on reconnect.

Visitors can open the mayor's guestbook, locate themselves with Find me, and
locate another present guest with Find visitor. These camera actions pin a
nametag and never change saves. Clicking the VIP arrival inset pins its displayed
VIP using the same selection behavior as clicking the person. Live guests do not
compete with ordinary NPC or VIP visitor slots.

Owner polls also apply pending saloon collections through the campaign's existing
persisted receipt timestamp. A credited collection queues a coin notification;
account refreshes and later polls cannot credit or announce it twice. Puzzle play
pauses these notifications and collection is applied on returning to town.

The shared appearance includes the owner's completed puzzle count (`completedRuns`).
From Tomorrow City onwards it picks the village animal wearing the space helmet, so
visitors see the same wearer as the owner without any stored choice. When a poll brings a
new count, the old wearer shrinks away and the new one grows back in its suit; reduced
motion swaps them at once.

## Presence lifecycle

The visit page sends a heartbeat immediately and every 12 seconds. Both visible town views check visitors every 3 seconds. Normal arrivals/departures therefore
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
  `sequence`, optional `browserToken` and optional owned `townId`. Active replies
  include `visitId` so the visitor can identify their own character.
- `DELETE /api/v1/villages/{publicId}/presence`: end the tab's `token` lease,
  including its latest `sequence`.
- `GET /api/v1/towns/{townId}/visitors?page=1`: owner-only current presence plus
  20 history entries per page, newest first, plus `saloonCollectedAt` for collection
  receipts. All timestamps use Unix milliseconds.
  The owner reply also includes `uniqueVisitors`: different signed-in players who have
  visited (each account once; signed-out visits never count), used by the Town Honours
  visitor ranks. The public guestbook never includes it.
- `GET /api/v1/villages/{publicId}/visitors?page=1`: the same public visitor
  entries and paginated history for a shared town, without the collection receipt.
  No account is required; private/deleted towns return 404.

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

The shared-town row lock serializes joins, departures, expiry and guestbook reads.
Origin validation, signed-in mutation CSRF checks and per-IP rate limits apply.
Departure additionally uses the unguessable lease token, so logout does not
prevent a tab from closing its own lease. Unpublishing stops new arrivals and
closes active visits on the next presence/guestbook read.

## Town Honours

A shared appearance may carry `appearance.honours`, exactly the client's
`publicHonours()` shape ([Town Honours](../honours.md)):

```json
{
  "version": 1,
  "earned": {
    "score-ace": {
      "at": 1790000000000,
      "evidence": { "levelId": 52, "score": 31200, "target": 15000 }
    },
    "first-fusion": { "at": null }
  },
  "showcase": ["score", "first-fusion"]
}
```

- `earned` maps catalog honour IDs to `at`, the earning time in Unix milliseconds, or
  `null` when unknown (history recorded before honours existed). Unknown or future IDs
  are never published.
- Only the score family (`score-ace`, `score-legend`) has `evidence`, and only its
  `levelId`, `score` and `target`.
- `showcase` lists at most three family IDs in the owner's order, each with a
  published rank.
- Nothing else is shared: no counts, progress, fusions, seen or announced flags,
  inventory, journal or account data.

The server recomputes the honours it can prove from the saved records and town, and
publishes them only when proven. First Perfect needs a three-star record within the
published levels. Score Ace and Score Legend need a completed normal puzzle from
level 37 with at least 2× or 3× that level's current star score target; their
evidence is the best such run, not the client's. Perfect Prospector needs three stars
on every published level. Prospect Hollow Complete needs the final enabled era with
every required building built and modernized, the same check that gates the server's
era advance. Raising a star target, or adding levels or an era, can therefore hide
these honours from visitors until the town meets the new requirement; the owner's
stored honours never change. Observation-based honours (fusions, gems, forge,
supplies, mine mastery and defence medals) are published as the owner's claims, as
described in [save integrity](save-integrity.md#town-honours).

A missing `appearance.honours` means unknown (an older owner client or server), never
an empty or revoked collection. `{ "earned": {}, "showcase": [] }` means the owner's
save tracks honours and has none to publish. A projection stores a save without
honours as `honours: null`, so visits trust that absence without reading the save;
`GET /villages/{publicId}`, `/latest` and the browse list omit that null. Appearances
projected before honours existed lack the field and are re-projected from the saved
profile on each visit, like level awards, until the owner's next save or sharing
change stores a new projection.
