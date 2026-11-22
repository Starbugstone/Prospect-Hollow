# Moon labels and the Quiet Stone

Start a fresh runner stack and pass doctor. Run
`bash scripts/verify-gameplay.sh run "$RUN" moon-labels`. The runner sets
`PH_MOON_ERA=quiet-signal` for `testing/browser/moon-labels.cjs`.

The intercepted `/moon-label-test` mounts the real Moon view with a developed
Quiet Signal town. The check first runs in WebGL, then switches the component to
its SVG path.

1. At 1440 × 900, 900 × 360 and 375 × 740, verify that visible labels are on
   screen and attached to their parcels without overlapping. Tap visible names
   and press Enter on a focused name. Each selects its own parcel.
2. Check that ordinary names disappear with village labels off and the Settler
   Domes finish hammer remains tappable. With labels on, wait for the header to
   show the requested language, then check that English and French name and
   status text stays inside the pill.
3. On the SVG map, also run at 844 × 360 and 430 × 932. With village labels off,
   tap the Quiet Stone. Its name and current story line appear within the map
   bounds and no parcel is selected. Enter on the stone hides its description.

This check tests the SVG controls after forcing the component onto its fallback
path. Graphics context-loss recovery and the campaign route to the Far Rim are
outside this fixture. The browser closes automatically. The log is
`moon-labels.log` and screenshots are in `artifacts/moon-labels/`.
