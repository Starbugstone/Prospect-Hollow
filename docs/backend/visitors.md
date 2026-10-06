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

The guestbook card folds and unfolds with one tap on its title, and the choice is kept
on the device. Its visit history is grouped by day in a scrolling box; older pages load
as the reader nears the end of the box (or with “Show older visits”). Pages merge by
visit ID, so new arrivals shifting the pages never hide or repeat a visit.

Signed-in players find other towns in the Shared towns panel, which never lists their
own towns. Discover deals up to seven shared towns at random: towns played in the last
14 days first, and among them towns the player had not visited when the deck was
shuffled. “Show other towns” deals the next seven of the same shuffle, so no town comes
back until every shared town has been shown; then a new shuffle starts. A visit made
while drawing marks its card Visited without reordering the deck. Search finds shared
towns by name (2–24 characters, any part of the name, ignoring case, names that start
with the search first, at most 20 results). The star on a card or on an open visit keeps
a town in Favourites, kept on the account for every device (up to 50). A favourite whose
owner stops sharing is hidden and returns if the town is shared again.

Each card shows the era, building count, mine level, people visiting now, whether the
saloon takings can be collected, whether the player has visited it while signed in (on
any device) and, once the shared appearance publishes Town Honours, the owner's
showcased honours at their best earned rank and the honour count. This spreads visits
across all shared towns instead of the first page.

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
- `PATCH /api/v1/account/profile`: save `displayName`, `visitingTownId` and optional
  `anonymousVisits`. A private visit records neither the public name nor the home town's
  name, so the guestbook shows a plain visitor without a return link; the home town is
  still stored so the visit counts for the visitor's `townsVisited`.
- `POST /api/v1/villages/{publicId}/presence`: join or renew using `token`,
  `sequence`, optional `browserToken` and optional owned `townId`. Active replies
  include `visitId` so the visitor can identify their own character.
- `DELETE /api/v1/villages/{publicId}/presence`: end the tab's `token` lease,
  including its latest `sequence`.
- `GET /api/v1/towns/{townId}/visitors?page=1`: owner-only current presence plus
  20 history entries per page, newest first, plus `saloonCollectedAt` for collection
  receipts. All timestamps use Unix milliseconds.
  The owner reply also includes the server's Town Honours social counts:
  `uniqueVisitors`, different signed-in players who have visited (each account once;
  signed-out visits never count). A visit is marked `signed_in` when it is recorded, so it
  keeps counting after the visitor hides their name, deletes their home town or erases
  their account ([privacy](privacy.md)), and `townsVisited`, different other players' villages
  visited from this town as its home town (each village once; the owner's own towns never
  count, and a village unshared or deleted later still counts while its visit records
  remain). The public guestbook includes neither.
- `GET /api/v1/villages?seed=…&page=1`: signed-in browsing. A draw of up to seven
  shared town cards (`villageId`, `name`, `era`, `buildings`, `mineLevel`,
  `saloonReady`, `visitors`, `visited`, `favourite`, `honours`) in the order of a
  16-hex-digit `seed` whose first eight digits are the shuffle time; omit the seed to get
  a new shuffle, and the reply returns the `seed` to request the next `page`. `honours`
  is `null` or `{earned: [id], showcase: [familyId]}` from the shared appearance.
- `GET /api/v1/villages?q=…`: name search, the same cards, up to 20 plus `more`.
- `GET /api/v1/villages/favourites`: the player's shared favourites, newest first.
- `PUT` / `DELETE /api/v1/villages/{publicId}/favourite` with `{}`: add (404 when not
  shared, 422 for one's own town or past 50) or remove a favourite. Signed-in, CSRF.
- `GET /api/v1/villages/{publicId}/visitors?page=1`: the same public visitor
  entries and paginated history for a shared town, without the collection receipt.
  No account is required; private/deleted towns return 404.

The `present` entry's `era: null` means that the renderer should use the host's
current era. A history entry retains its arrival era. Presence endpoints expose
no account IDs, emails, private home town UUIDs, or raw tokens to hosts.

Migration 15 adds `town_favourites` (player, town, time; deleted with either) and an
index on `visitor_visits(visitor_key, town_id)` for the Visited marks and ordering.

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
    "score-silver": {
      "at": 1790000000000,
      "evidence": { "levelId": 52, "score": 39000, "target": 15000 }
    },
    "fusion-bronze": { "at": null }
  },
  "showcase": ["score", "fusion"]
}
```

- `earned` maps catalog honour IDs to `at`, the earning time in Unix milliseconds, or
  `null` when unknown (history recorded before honours existed). Unknown or future IDs
  are never published.
- Only the score family's ranks have `evidence`, and only its `levelId`, `score` and
  `target`: the server's best completed normal puzzle against the level's current star
  score target, never the client's evidence.
- `showcase` lists at most three family IDs in the owner's order, each with a
  published rank, and at most one player distinction ID (`player-…`).
- `distinction` describes that player distinction when the owner holds it at the time
  of the read: `{ "id": "player-time", "at": 1790000000000, "tenure": { "unit": "year",
"count": 2 } }`, or `{ "id": "player-alpha", "at": … }` for an event. It belongs to the
  owner's account, not the saved town, so the server checks it and computes the time
  step on every visit, latest refresh and directory card; one the owner does not hold
  leaves the showcase. See [player distinctions](../honours.md#player-distinctions).
- Nothing else is shared: no counts, progress, fusions, seen or announced flags,
  inventory, journal or account data.

Visitors only see honours the server verified itself. A rank is published when the
owner earned it and it is in the save's server-owned `verified` list, or the server
proves it at projection time. `backend/src/Honours.php` evaluates every rank's exported
measure (`stars`, `score`, `era`, `count`, `distinct`, `powers`, `social`) over a proof
state of the accepted save: its replayed records, town and powers, the Town Honours
counters the integrity replay credited (never the client's `honours.counts`) and the
server's own social counts (`uniqueVisitors` and `townsVisited` above). A save outside
the integrity replay has no proof state and publishes nothing. Every accepted save,
signed recovery and admin restore adds each rank it proves to `verified`, and nothing
ever removes one: a raised star target, a moved goal, a removed rank, an older restored
snapshot or a visitor's deleted town cannot unpublish an honour verified earlier. The
counters and their limits are described in
[save integrity](save-integrity.md#town-honours). Claims the server cannot verify stay
in the owner's own save and are simply not published.

A missing `appearance.honours` means unknown (an older owner client or server), never
an empty or revoked collection. `{ "earned": {}, "showcase": [] }` means the owner's
save tracks honours and has none to publish. A projection stores a save without
honours as `honours: null`, so visits trust that absence without reading the save;
`GET /villages/{publicId}`, `/latest` and the browse list omit that null. Appearances
projected before honours existed lack the field and are re-projected from the saved
profile on each visit, like level awards, until the owner's next save or sharing
change stores a new projection.
