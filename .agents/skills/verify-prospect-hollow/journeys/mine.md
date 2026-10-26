# Mine: feedback leaves the board playable and visible

**Prerequisites:** fresh runner stack and passing doctor. Signed-out local profiles
from `playedProfile(level)`; all earlier levels have one-star records.
Before starting the mine, import a disposable save stocked with one of each power,
using the game's `POWERS` catalog and `createSaveFile`/`campaign.importSave`.
Direct edits to campaign inventory are ignored by the production integrity guard.
**Command:** `bash scripts/verify-gameplay.sh run "$RUN" mine`.
**Implementation:** `testing/browser/mine-feedback.cjs`.

1. Open `/`; use the existing game store's `startLevel` to open levels 1, 289, 294,
   312, 319 and 324. Dismiss `dialog[open].obstacle-guide` if present.
2. For English and French, normal and continuous mode, check five viewport sizes:
   1440×900, 1280×800, 390×844, 320×568 and 844×390.
3. Show and dismiss `.guidance-tip`. Inject each supported celebration into the
   store, verify the board remains unobscured, then clear it and check the tip returns.
4. Click `[data-power-id="tnt"]`, observe the targeting caption, and cancel via
   `.mine-feedback .board-caption button`.

The board rectangle, tools rectangle, document scroll and page height must remain
unchanged. Objectives and power buttons must fit. All 120 configurations must pass,
with no failed HTTP responses or browser errors.

This is a layout/interaction journey. Celebrations, mode changes, and inventory are
prepared directly; no victory or reward persistence is claimed. Targeting is cancelled,
and the TNT count must stay at one. Every level gets a new disposable browser
context. It does not replace campaign simulation or the unlimited-moves regression.

Evidence: `mine.log`, `artifacts/mine-feedback/report.json` and screenshots beside it.
Cleanup: contexts close automatically; run the shared cleanup command. Never reduce
the configuration matrix to hide a layout failure.
