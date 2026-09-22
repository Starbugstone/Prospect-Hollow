[Issue #40](https://github.com/Starbugstone/Prospect-Hollow/issues/40) is addressed along with jackpot interaction performance and layout.

- The camera checks sightlines to parcel foundations, lifting its angle when an intervening ridge blocks the village while retaining zoom distance and heading.
- The progress panel toggles on desktop and mobile and retains its state after interactions. Desktop starts open; small screens start closed.
- Available parcel rows finish, buy, or use a hammer directly and keep the list open. Ready work comes first, then ascending coin cost. Hammer actions also show the coin price.
- The bridge no longer has an extra ground-level road and porch boards crossing the water underneath it.
- Jackpot opening and reel timings are unchanged. The hidden Phaser board sleeps during results and chests, resumes on the next level, and wakes for destruction when leaving. Chest spark movement uses transforms, marquee lights animate opacity, and bounded background rays fade at their edges. Symbols, payline, reward text, and short-screen layouts fit their containers.

Chromium/Playwright checks covered all six settlement eras and 320×568, 390×844, 768×1024, 844×390, 1440×900, and 1920×1080 viewports. Checks included English and French, desktop and mobile toggle state, coin and hammer spending, repeated parcel actions, winning-symbol alignment, result overflow, next-level recovery, and sleeping-renderer destruction. No page or console errors were reported. Tests used disposable browser contexts and generated era fixtures.

A controlled comparison during the steady reel at 1440×900 recorded 650 ms of browser main-thread work over about 1.24 seconds with the hidden mine running, versus 54 ms with it suspended (about 92% less). Hidden mine frames dropped from 35 to zero. Chromium used ANGLE/SwiftShader software rendering; frame timing varied across runs, and the final sample's median remained about 33 ms in both cases. This confirms reduced resource contention, not a promised hardware-device frame rate.

The existing 1,032-test suite passed with `npm test -- --maxWorkers=4`; the unrestricted worker run first hit an unrelated asset-test timeout on the mounted filesystem. Additional console-helper tests cover persistence, limits, validation, and failed saves. Production build succeeds with the existing large-chunk advisory.

The console command `prospectDebug.grant({ coins: 100000, hammers: 5 })` adds test coins and tops up hammers to their normal cap, saving immediately. Its balances survived a browser reload.

[Desktop village](images/issue-40/village-desktop.png) · [Parcel actions](images/issue-40/parcels-phone.png) · [Phone jackpot](images/issue-40/jackpot-phone.png) · [Landscape jackpot](images/issue-40/jackpot-landscape.png)
