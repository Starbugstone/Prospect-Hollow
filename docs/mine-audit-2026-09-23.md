# Mine gameplay audit — 23 September 2026

All nine findings from the initial audit are addressed. The follow-up implements
the user's instruction to fix the remaining defects and rule inconsistencies.
Unlimited puzzle moves, optional speed rewards, relic protection, and free
recovery remain in place.

## Changes

1. **Direct blast damage.** Specials damage crates/stone only when their actual
   footprint hits them. Only ordinary color matches damage adjacent blocks.
   Secondary explosions can legitimately extend the footprint. Overlaps still
   give one hit per resolution step; direct fusion hits retain double damage.
   Hint ranking follows the same distinction.
2. **Placement highlights.** Accepting a target clears the cached preview
   immediately. Its squares fade over 180 ms during activation, or disappear
   immediately with reduced motion. Queued targets clear their cached preview.
3. **Inventory reservation.** A power in flight is excluded from available stock.
   Queued activations revalidate stock, and a failed consumption cannot commit a
   free blast. Tiles and score commit only after successful animation and
   consumption. Leaving the level releases the reservation without spending it.
   Row powers also consume before victory rewards are calculated.
4. **Anchored bonuses.** Chain expansion checks whether the hit can actually
   consume the bonus. A normal hit releases a chained bonus without firing it;
   frozen bonuses likewise cannot fire while surviving. A fusion may release and
   fire a bonus with one chain layer, but two chain layers absorb both hits.
5. **Dead-board recovery.** Three unsuccessful random shuffles are followed by a
   deterministic arrangement of existing pieces that supplies a legal swap.
   Anchors, relics and holes remain fixed during this rearrangement. If sparse
   geometry cannot support a normal match, a free cross provides an in-place
   action. A fully anchored chamber gets a free rescue sweep using normal
   double-hit resolution. Recovery never spends inventory or increments moves,
   and never reports success while leaving an unfinished board with no action.
   Session changes cancel old recovery work. Hints recognize isolated bonuses.
6. **Rainbow rules.** Swapping a rainbow with a jewel targets that color.
   Double-tapping it targets the most common ordinary color, with stable ties.
   Chained rainbows use the same deterministic color rule; fusion networks retain
   their shared chosen color. The English and French mining guides explain this.
7. **Campaign pacing.** The corrected bonus rules bring level 142 within its
   existing pacing checks. The remaining slow cases in levels 33 and 52 spent
   many turns chasing one bottom-edge ice tile. Their ice now stays above the
   last row, using the existing open-row configuration. Total obstacle layers,
   chest targets, and optional speed targets are unchanged. The original pacing
   assertions remain intact. A digest protects the other 238 original layouts;
   explicit regressions protect the workload and rewards of the two retuned
   levels.
8. **Toolbar chain reactions.** TNT, row clear, and tile breaker trigger bonuses
   they hit through the same chain resolver used by board bonuses. Previews
   include the full reaction, and animation shows both the toolbar effect and
   the triggered bonuses. Color wand accepts ordinary jewel colors, so it cannot
   erase all bonuses of one type as if they were a color. Bonuses formed by its
   subsequent cascades still follow the normal rules.
9. **Fusion earnings.** Every ordinary jewel actually removed by a fusion enters
   the same collection ledger as ordinary matches and single-bonus clears.
   Mining earnings and ore orders count it exactly once, including jewels
   released through a chain. Relics and surviving anchored jewels do not count
   as collected jewels.

Sources: [bonus resolver](../src/game/engine/BonusActivator.js),
[match resolution](../src/game/engine/TileManager.js),
[recovery](../src/game/engine/BoardRecovery.js),
[game store](../src/stores/gameStore.js),
[inventory](../src/stores/inventoryStore.js),
[effects](../src/game/phaser/BonusEffects.js).

## Cascade formation

No missing earned bonus was reproduced in the tested four/five-in-a-row,
vertical, T, and L falls. Regression fixtures start without a match, remove cells,
apply actual gravity, and verify each resulting bonus's type, position,
protection and surviving identity. Presentation tests ensure its reveal finishes
before gravity or the next blast. A newly earned bonus can legitimately activate
immediately when caught by the following blast in the same move.

## Verification

Regression coverage includes:

- Last-item reservation, stale queued commands, valid two-item queues, invalid
  targets, cancellation, and row-power consumption.
- Full toolbar chain footprints and previews, rainbow color selection, normal
  and fusion hits on anchored bonuses, and exactly-once fusion collection.
- Repeated unsuccessful shuffles, deterministic recovery without changing gem
  identities, sparse and fully anchored chambers, and session cancellation.
- All 324 campaign levels, the unchanged pacing thresholds, and progression
  beyond 100 moves after the optional speed target has elapsed.

Browser verification uses local `http://127.0.0.1:5202`, Chromium at 1440×1000 and
390×844. Real toolbar and board clicks confirm a TNT → cross → bomb reaction,
stock reservation while animating, fading placement markers, and an untouched
crate outside the full reaction footprint. A mobile double-tap clears exactly
the rainbow's most common color. Browser recovery checks cover both deterministic
rearrangement and a rendered, usable rescue cross. No mobile horizontal overflow
was observed.

The Playwright MCP could not find its Chrome executable, so browser verification
used Playwright CLI with installed Chromium. Screenshots, browser scripts and
logs are in ignored `output/playwright/mine-audit/`. The final browser run had no
application errors or failed asset requests, only software-WebGL readback
warnings. An initial recovery harness overrode global randomness and collided
with Phaser's texture UUIDs; it was corrected to control only the synchronous
shuffle, then repeated successfully after reload.

All **1,349 tests across 80 files pass**, as does the repository formatting check.
The production build passes with the existing large-chunk warning. Final test
results are recorded in `output/playwright/mine-audit/fixes-final-tests.log`.
