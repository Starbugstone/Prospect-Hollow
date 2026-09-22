# Prospect Hollow contributor rules

## Permanent gameplay rule: no move limits

The user has explicitly required unlimited puzzle moves. All contributors and
agents must preserve this rule unless the user explicitly reverses it.

- Never add move or turn caps, move-exhaustion failure, forced restarts, or any
  condition that blocks puzzle completion because a move count was reached.
- This applies to the normal campaign, every current and future chapter, side
  quests, and replays. Do not simulate unlimited moves with a large finite
  `maxMoves` value: gameplay must have no move budget.
- Never add a hard puzzle timer that prevents continued play or normal puzzle
  completion. Existing optional speed and score bonus thresholds may be missed;
  the player must remain able to continue and complete the puzzle normally.
- A recorded move count or elapsed time is a statistic, not a failure condition.
  Difficulty must come from coherent layouts, objectives, and mechanic
  combinations, while puzzles remain solvable with unlimited moves.
- A board with no legal match must remain recoverable, for example through the
  existing free reshuffle. Lack of a legal match is not move-budget exhaustion.
- Building construction measured in completed puzzles is allowed. For example,
  two completed puzzles to construct a landmark is a construction duration, not
  a cap on moves inside either puzzle.
- The user also explicitly permits optional event preparation countdowns with a
  completed-normal-puzzle budget and a persistent real elapsed-time deadline
  (including time away), whichever is reached first. These start only when the
  player accepts the event and are separate from
  move counts within a puzzle. They must never interrupt or fail an active puzzle,
  change its normal earnings, or block campaign progression. Budgets and expiry
  outcomes require their own agreed event design; do not infer
  a time cap for the puzzle from permission to time an optional event.
- Finite headless test budgets and runaway-cascade guards are diagnostics or
  technical protections, not gameplay move caps. Never expose them as a move
  allowance or use them to force a player to restart a puzzle.

When changing puzzle progression, preserve and run the regression coverage in
`testing/chapter-progression.test.js`, including matching beyond 100 moves after
the optional speed target has elapsed. Extend relevant regression coverage if a
new mechanic creates another route that might accidentally gate completion.

## Maintainable era and feature evolution

Keep repeated era configuration in one authoritative definition. When several
call sites express the same capability or rule, use a shared contract, helper or
factory so adding an era does not require repeating the same edits throughout
the game. Prefer the simplest abstraction that removes real duplication; do not
force class interfaces into JavaScript or abstract code with only one use.

Preserve existing gameplay, rewards and unlimited moves while refactoring.
Cover shared behavior and extension to a new era with meaningful regression
tests, including fallback behavior for unsupported or incomplete definitions.

Apply the same principle to shared feature lifecycles: future events, progression
tracking and cinematic presentation should use common contracts and lifecycle
helpers instead of duplicating state transitions, persistence or presentation
pipelines for each building. Keep feature-specific content in definitions and
reuse the shared implementation where behavior is the same. See
[the era architecture guide](docs/era-architecture.md) for the current contracts,
renderer registries and extension checks.
