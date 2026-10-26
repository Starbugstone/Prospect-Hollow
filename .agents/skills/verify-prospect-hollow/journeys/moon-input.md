# Moon: parcel labels, gestures and return to the valley

**Prerequisites:** fresh runner stack and passing doctor. Fixture creates a
Twin Hollows town with its elevator and Moon lots at level 1. No account.
**Command:** `bash scripts/verify-gameplay.sh run "$RUN" moon-input`.
**Implementation:** `testing/browser/moon-input.cjs`.

The fixture route `/moon-input-test` exists only through Playwright interception;
it mounts the production `TownMoonView` component and records its emitted actions.

1. At 1440×900, 900×360 and 375×740, run both mouse and touch contexts.
2. Select Ribbon landing in fixture state so its distant label is visible. Activate
   `[data-moon-lot="ribbonLanding"]` twice: exactly two selection events and no
   camera movement. **Back to the valley** emits one close event.
3. Focus that label and press Enter. Escape reaches the document. Dragging from the
   label orbits without selecting; release or touch cancellation clears held pointers.
4. Move the pointer after release: the camera must stay fixed. Reset the view and
   tap the exposed Earth model; it emits a second close event.

No letters list appears over the map; there are no browser errors. The fixture's
close event proves the component's navigation contract, not a mounted valley return.
No persistent gameplay data changes: this journey inspects input and camera state.
It does not prove hidden-label parcel picking or all parcel shapes; use the
`moon-parcels` regression for those contracts.

Evidence: `moon-input.log` and six `artifacts/moon-input/*.png` captures.
Cleanup: contexts close automatically, then use the shared stack cleanup.
