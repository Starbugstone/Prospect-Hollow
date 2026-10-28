# Valley: build the well and reload

**Prerequisites:** fresh runner stack and passing doctor. No account or cloud seed.
**Command:** `bash scripts/verify-gameplay.sh run "$RUN" valley`.
**Implementation:** `testing/browser/valley-persistence.cjs`.

1. Open `/play` in a fresh English browser context, with real software WebGL.
2. Click `.town-tab-build`. The `.town-build-next` panel offers **Play level 1**.
   Return to Village, open the town-name menu and close it with Escape, then reopen Build.
3. Click **Build for free**. The campaign's well level becomes 1; coins and next
   puzzle stay unchanged. Return with `.town-tab-village`; the tutorial says
   **Fresh water at last! Coins come from the mine. Tap Mine to play a puzzle.**
   Open the town-name menu again and close it with Escape. Capture the town.
4. Reload the page, reopen Build, and verify the well level, coins and next puzzle.
   **Build for free** must no longer exist. Return to the village, check that tutorial
   message remains, open and close the town-name menu, and capture again.

The inspection helper exposes Pinia stores without preloading or resetting a save.
The real Build button performs construction; the test does not call the construction
action directly. Reload proves the normal device save retained the result.

Failure checks: no double free build, no coin charge, no consumed puzzle, no API
request while signed out, and no browser console or uncaught errors. This does not
test a later worksite finish, every valley parcel, or cloud synchronization.
The town-name menu must keep working after construction in the same mounted view;
a reload alone would hide a stale construction receipt that blocks the menu.

Evidence: `valley.log`, `artifacts/valley/result.json`, `built.png`, `reloaded.png`.
Cleanup: the browser context closes automatically; clean the stack with
`bash scripts/verify-gameplay.sh cleanup "$RUN"`. Evidence remains.
