# Mobile village and gem clarity

The village summary was taking too much space on phones, and the chapter gem variants changed the original style too much. This follow-up also fixes the reported sapphire seal outline.

- On viewports up to 900 pixels wide, or 500 pixels tall, the village summary starts hidden behind a **Progress / Progression** button. The scene fills the available viewport. Desktop keeps the inline summary.
- The popup contains needs, protection, the next building and chapter rewards. Its actions open building details, finish construction, enter the mine or advance the era. Close, Escape and backdrop dismissal return to the village; keyboard focus returns to the button. Returning from the mine keeps the popup closed.
- Original gem files remain unchanged. Chapters vary at most two gem types with small changes to the central facet and highlight. The dark crystal clusters and extra facet outlines are removed. The palette, guide and board use consistent gem identities.
- Ruby, sapphire and emerald seals are generated from the same outline points as their gems. Sapphire now has the correct diamond outline; ruby has its original shield-like outline. Color and R/S/E badges remain additional cues.

## Verification

Chromium checks at `http://127.0.0.1:5174/` covered French mobile 390×844 and 320×740, landscape 844×390, tablet 768×1024, desktop 1440×900, and a forced SVG fallback at 320×740. At 390×844 the scene occupies all 844 pixels. Popup content fits without horizontal overflow, including landscape chapter rewards. Building inspection, construction completion, mining, return, Escape, focus restoration and backdrop dismissal were exercised.

The sapphire, ruby and emerald outlines were visually checked on the board and in the French obstacle guide. The current Develop campaign has all three seals at level 51; level 58 was also opened and currently contains chains and relics. The shared seal fix applies wherever those seals appear.

All **64 targeted tests** passed (progression guidance, beta feedback, expansion rules and town layout), including existing colored-seal rules. A separate asset check verified all three seal outlines against their gems and all 864 level/gem art-to-texture mappings. Original gem assets are byte-for-byte unchanged. Production compilation and formatting passed. Browser checks reported no uncaught application exceptions or failed HTTP requests; the normal mobile flow also had no console errors. Forced WebGL unavailability produces the expected fallback notice.

## Screenshots

- [Unobstructed mobile village](../images/polish-village-mobile.png) and [optional progress popup](../images/polish-village-progress.png)
- [Original art with subtle variants and matching seals](../images/polish-gem-comparison.png)
- [French seal guide](../images/polish-sapphire-guide.png) and [seals on the board](../images/polish-seals-board.png)
