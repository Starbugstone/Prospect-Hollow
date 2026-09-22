# Trust boundary and compatibility decisions

The server is authoritative for account ownership, village revision, money, inventory, buildings, shop stock, mining board, objectives and rewards. The browser sends intentions. It never submits a replacement profile, final balance, price, timestamp, score, jewel count or completed mining result. Unknown request fields and commands are rejected.

Symfony 7.4 handles HTTP routing and responses. Doctrine DBAL provides one database connection and explicit transactions; this implementation uses compact JSON records rather than ORM entities. Recovery uses cryptographically random single-use emailed proofs persisted as keyed hashes, explicit POST confirmation, and database-backed sessions, rather than Symfony's signed login-link authenticator. A guest-link proof is bound to the original guest and session. Existing cloud villages require an explicit choice; balances are never merged.

Each mutation locks the player row, rechecks session validity, checks an existing action receipt **before** checking the expected revision, validates the command, changes state, and writes the profile, run, receipt and economy audit record in one transaction. Reusing an action ID with different content is a conflict. Concurrent devices cannot overwrite one another's snapshots or independently spend the same stock. Account deletion and session revocation participate in the same locking order. Browser cookies are HttpOnly, SameSite=Strict, and Secure with a `__Host-` prefix on HTTPS. Mutations require the exact configured Origin, JSON content type and a session-bound CSRF header.

## Private accounts and optional village visits

Email registration links the current guest village after explicit proof confirmation. Signing in on another device recovers that account's village. Each player has one cloud save and one active mine; multiple save slots are not implemented. Private reads and writes derive ownership from the session, never a requested player ID.

New and existing accounts are unlisted by default. Only linked players can opt in through account settings, choosing a public village name. The server validates this setting through the same revision, CSRF, ownership and replay checks as other commands. Opting out deletes the public projection immediately; old visit URLs return 404. Publishing again creates a new public ID. Account deletion also removes the projection.

Authenticated players, including guests, can read the leaderboard and visit listed villages. These endpoints select only the separate `public_villages` projection: public ID/name, era, building progress, completed mines, population and building appearance. They never serialize private profiles, emails, private player IDs, coins, inventory, active mines, reward receipts or construction costs/timers. Public IDs cannot target mutations. There are no village-interaction endpoints.

The browser renders visits in an isolated town model with building/mine actions disabled, including the SVG fallback. Visiting does not patch the visitor's campaign or game stores. Camera controls remain available. The visitor's underlying game input and town rendering pause while the dialog is open.

Rank is ordered by era, completed building and modernization stages, then completed mines. A composite index supports fixed 20-entry pages without sorting private save JSON. Projections update atomically with relevant owner actions and skip unchanged writes; ordinary mining moves do not update the leaderboard. Opting out prevents future reads, but cannot retract information someone already viewed or copied.

## Puzzle validation

PHP validates individual swaps, bonus activations and inventory power targets against its saved board. It generates refills and calculates cascades, tile damage, relic collection, score and completion. Level eligibility, museum replay access and one active run per player are checked before issue. Continuous runs credit only their bounded lifetime allowance per player/level and cannot become normal victories. Run ownership is part of every SQL query. Runs expire after 24 hours.

The port is checked against the JavaScript engine using all 324 authored levels and explicit obstacle/fusion fixtures. Automatic dead-board shuffles preserve tiles, inventory and score; paid shuffle powers follow the shared resolution rules. Timing rewards use server wall time; browser active-time edits cannot improve them.

This prevents fabricated completion API calls. It does **not** prove a human played: bots can still submit legal moves, and account sharing remains possible. Dependency vulnerabilities, stolen email accounts/cookies, host compromise, denial of service and future implementation bugs remain risks. This is a reviewable implementation with automated checks, not a guarantee of “no more hacks” or a substitute for production security review.

## Current game compatibility

The catalog follows `main` through PR #45, including eight eras, 54 buildings, 324 levels, ore orders, lanterns and ordered survey markers. PHP owns these objectives and refuses completion until all are met. Unlimited moves and optional speed targets remain unchanged. Building completion queues durable cinematic receipts; acknowledgment changes presentation state only. Earlier PRs #36 and #37 superseded the original balancing numbers in issue #10. The content exporter takes the current catalog, per-era prices, shortened supporting-building progression, leisure happiness, chest scaling and capacities from the game. PHP parity fixtures cover these shared values. Content has a hash identifier; a run issued against different rules must be abandoned explicitly rather than silently reinterpreted.

Current construction behavior is retained: small projects can finish immediately; other projects earn work from accepted normal victories and require a finish action. Hammers instantly build an eligible plot without a coin debit. Only completed buildings provide benefits. Era changes require all projects, including optional ones, to finish so no project is stranded in its old era. Project work requirements are stored at start and are not recomputed from a later catalog. Chests are server-selected, saved and granted before the visual reveal; pressing the roulette cannot choose a different reward.

Bandit raids, post-war workshop fires and contemporary storm cleanup are settled during accepted victories with fixed five-victory cadence and the current era/defense rules. The receipt is immutable; acknowledging or replaying its animation does not deduct again, grant a bounty, refund losses, or recalculate defense. The town bell does not change a settled cloud encounter. Withholding an acknowledgment cannot suspend the five-victory cadence or future losses. The latest encounter replaces the previous notice; previous action receipts and ledger entries remain immutable, and stale acknowledgment IDs cannot affect the new notice. Presentation coordinates are never saved.

## Local saves and connectivity

Editable local saves cannot establish verified cloud wealth. This branch deliberately rejects legacy imports instead of accepting the trust exception proposed in issue #10. The original local save key remains untouched in cloud mode; “Open local demo” explicitly returns to that separate village. No reset/import button can replace cloud progress. This is a deliberate migration policy change that needs product review before release.

A linked account recovers confirmed progress on another browser. A guest only survives while its session cookie remains accessible. Cached cloud snapshots are display/cache data, never inputs to the server. Every action is stored locally with its original ID and payload before transmission. A lost response is retried with the same ID. Pending actions block further spending until resolved. Permanent rejection or a stale revision refreshes the server profile and requires the player to choose again; it never rebases a purchase automatically.

The frontend owns input, hints, swap feedback, cascades and reward presentation. It rejects obvious invalid swaps locally without an HTTP request and starts valid swap animation immediately while the server independently validates and saves the move. Only server-returned cascade steps and the confirmed snapshot change displayed results; refills, completion and rewards are never predicted. Renderer errors still reconcile to the saved result. A single buffered swap is bound to the visible gem IDs and types and executes only if those pieces survive unchanged. Income polling pauses while a mine is active so it cannot queue ahead of mining input.

Rejected or interrupted speculative swaps reconcile after their animation finishes. Account changes and navigation invalidate old animation continuations. Latency longer than the initial swap still creates a wait before server cascades can play; this deliberately keeps unpredictable refills and rewarded outcomes authoritative.

New rewarded moves and town actions require connectivity. There is no second writable cloud wallet during outages, and no client-reported offline mining completion endpoint. An interrupted run resumes from its last accepted board within its expiry. Closing/clearing the browser before an unsent action reaches the server can lose that action, but cannot erase already confirmed progress.

The same-origin web application works on PC/tablet/mobile browsers. Packaged Capacitor/native token transport, secure native credential storage and cross-origin APIs are not included; do not ship a static client secret or enable wildcard CORS to add them.

## Operations

Keep the database private, use HTTPS and authenticated SMTP, disable debug output, maintain dependencies, protect deployment credentials, and configure edge limits. API errors never return stack traces. Authentication secrets, cookies, email links and request bodies are not logged. Emailed proofs are URL fragments, keeping them out of ordinary access logs. SMTP failures produce a neutral response and a credential-free error marker. Durable limiter buckets work across PHP workers; housekeeping is separate from HTTP requests.

See [hosting and restore instructions](hosting.md) and [OpenAPI contract](openapi.yaml). Production hosting, real SMTP delivery, backup scheduling, staging restore and an independent security review remain deployment validation tasks.
