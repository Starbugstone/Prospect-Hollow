# UX upgrade plan — 23 September 2026

A walkthrough of the current `develop` build as a first-time player: the landing page, the village tour, the first free building, level 1 of the mine, and the mine at phone size. The goal is an interface that feels hand-made, calm and obvious to navigate, instead of dense, over-explained and generic.

This is the original proposal. See [the implementation review](ux-upgrade-review.md) for source-backed corrections, implemented changes, rejected assumptions and verification results.

## How this review was done

- Local Vite build, fresh profile, Chromium at 1280×800 and 390×844 (iPhone 12 Pro preset).
- Screens visited: Welcome → Enter the village → village tour → Well details → Start building → Go mining → level 1 guide → level 1 board → phone mine view.
- UI strings and conditions were then traced to their source files.
- The phone village screen could not be captured (the preview browser failed on the WebGL canvas), so phone village notes come from page text and code, not from a screenshot.

Priority: **P1** fixes something that confuses or blocks a new player, **P2** clearly improves clarity, **P3** is polish.
Effort: **S** is copy or CSS only, **M** is one component, **L** spans several components or needs new behavior.

## Guardrails for every change

- **Unlimited moves stay.** Removing the words "No move limit" is a copy change only. There must be no move cap, move budget or hard timer (see `AGENTS.md`). Keep `testing/chapter-progression.test.js` passing, including the check for more than 100 moves.
- **Translations.** English strings are translation keys. Every changed string needs a matching entry in `src/i18n/fr.json`, or the French build falls back to English.
- **Accessibility.** Keep the existing `aria-label`s, keyboard board controls, reduced motion and high contrast. When a visible label is removed, the accessible name must remain.
- **Era architecture.** Village changes that affect plots, building cards or indicators should go through the shared era contracts in [era-architecture.md](era-architecture.md), not per-era copies.

## Summary

The interface is not hard because of any single broken screen. It feels generated because of accumulation:

1. **The copy performs instead of informing.** Tiny uppercase headings over most blocks, poetic headings, repeated "take your time" reassurance, and marketing slogans inside the game.
2. **The same fact appears two or three times** on one screen (level name, ice count, "no limit").
3. **There are too many ways to move around:** top tabs, a village ✕, "Back to village", "Go mining", a Mine button and a mine label on the map.
4. **Everything is shown at once.** The first village screen has about 20 controls, 11 identical "Build" pills and a row of unlabeled zeros.
5. **Teaching happens in modals before the player can act.** A seven-step tour covers the plots it tells you to tap, and level 1 explains fusions before your first match.

The biggest gains come from removing things.

---

## 1. Copy and tone

### 1.1 Uppercase headings everywhere — P1 · S

**Observed.** Small, letter-spaced uppercase headings sit above most blocks: "✦ A MATCH-3 FRONTIER ADVENTURE", "MAKE IT YOURS", "PLAY YOUR WAY", "YOUR BRILLIANCE", "WHEN THE WORK IS DONE", "MINING GUIDE", "TOWN COINS", "PLAY TIME", "BEST CASCADE". The stylesheets contain 72 `letter-spacing` declarations.

**Why it matters.** This is the most recognizable template look. It adds a line of noise to every block without telling the player anything.

**Correction.**

- Delete the heading wherever the block's own title is enough.
- Keep at most one small label style, for stat captions such as "Score" or "Time", in normal sentence case.
- Remove decorative ✦ ✧ glyphs from text.

**Where.** `src/components/SettingsDrawer.vue:10`, `:102`; `src/components/HudPanel.vue:4`; `src/components/town/TownBuildingDetails.vue:36`; `src/components/LandingView.vue`; `src/components/ObstacleGuide.vue`; the `.eyebrow` rules in `src/styles/*.css`.

**Done when.** No screen has more than one uppercase label, and none of them sits directly above a heading that says the same thing.

### 1.2 Poetic or filler lines — P1 · S

**Observed.** Headings and helper text describe a mood instead of a function.

| Where                        | Current                                                          | Proposed                                                           |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `SettingsDrawer.vue:11`      | A moment of calm                                                 | **Settings**                                                       |
| `SettingsDrawer.vue:17`      | Set the mood for your next cascade.                              | _(delete)_                                                         |
| `HudPanel.vue:4`             | YOUR BRILLIANCE                                                  | **Score**                                                          |
| `HudPanel.vue:26`            | Take your time. Your reward is waiting.                          | _(delete; the chest icon already says a reward is coming)_         |
| `HudPanel.vue:92`            | Clear the obstacles to finish. A reward awaits at your own pace. | **Clear all the ice to finish.** _(generated from the level goal)_ |
| `App.vue:210–213`            | Explore the seam · No move limit                                 | **Clear 32 ice** _(the goal, with its icon)_                       |
| `App.vue:65`                 | BIG MATCHES. BIGGER REWARDS.                                     | _(delete)_                                                         |
| `ArcadeBanner.vue:98`        | ✦ MATCH. BLAST. GO MEGA. ✦                                       | _(delete, or a short "Go!" if the banner needs a start cue)_       |
| `TownBuildingDetails.vue:36` | WHEN THE WORK IS DONE                                            | **After building**                                                 |
| `LandingView.vue:26`         | Play at your pace. Your village can wait.                        | _(delete)_                                                         |
| `JourneyProgress.vue:10`     | A chest each puzzle / Next chapter gift                          | **Chapter reward in 6 puzzles** _(one line, with the reward icon)_ |

### 1.3 "No pressure" repeated on every screen — P2 · S

**Observed.** "Play at your pace", "Your village can wait", "at your own pace", "Take your time" and "No move limit" appear on the landing page, the HUD, the goal text and the status line.

**Why it matters.** Repeating the reassurance makes it feel scripted. A game without move limits shows it by never displaying a move counter.

**Correction.** Say it once, in the first mine guide ("There's no move limit — play as long as you like"), then stop. The unlimited-move behavior itself does not change.

### 1.4 One voice, not two — P2 · S

**Observed.** The village uses a cozy frontier voice ("A little sparkle. A place to call home."). The mine header and banner use arcade hype ("BIG MATCHES. BIGGER REWARDS.", "GO MEGA").

**Correction.** Pick the cozy frontier voice for all UI copy. Keep the excitement in sound, particles and the combo banner visuals, not in slogans.

### 1.5 Cryptic separators and symbols — P1 · S

**Observed.** Middle dots and symbols pack several facts into one line:

- "Mine Level 1 · ✦0 →" on the map
- "≤ 2:34 · 1 bonus" under the play time
- "0/76" next to a compass icon
- "Lv. 1" on built plots

A new player cannot decode "✦0" or "≤ 2:34".

**Correction.**

- Map mine label: **Mine · Level 1**. Drop "✦0" until stars mean something, and drop the arrow because the pill is already a button.
- Time target: **Under 2:34 for a bonus chest**, or just show a small chest icon on the timer that lights up while the time is still under target.
- Era progress: **Town upgrades 0/76**. Show it only once the first upgrade is available.

### 1.6 Duplicate information on the mine screen — P1 · S

**Observed on level 1 (desktop).**

- The level name appears three times: the large title "First light", the subtitle "First light", and the board header "LEVEL 01 · First light".
- The ice count appears twice: "32" above the board and "0 / 32" in the sidebar.
- The goal label says "Ice & stone" when the level only contains ice (`gameStore.js:140`, `LevelGenerator.js:214`, `MobileGameHeader.vue:60`).

**Correction.**

- Show the level name once: "Level 1 — First light".
- Show the goal once, next to the board: an ice icon with "0 / 32".
- Build the goal label from the obstacles actually present in the level ("Ice", "Stone", "Ice & stone").

### 1.7 Technical wording shown to players — P2 · S

**Observed.**

- "Export your progress to a JSON file…" (`SettingsDrawer.vue:23`)
- "Choose a valid Prospect Hollow save JSON file." (`saveTransfer.js:6`, `SettingsDrawer.vue:200`)
- "Reset progress for testing" (`SettingsDrawer.vue:111`)

**Correction.**

- Use "Save a backup file" and "Load a backup file", and "That file isn't a Prospect Hollow backup."
- Show the testing reset only in development builds. Players who need a real reset get "Start a new village", with the existing confirmation step.

---

## 2. Navigation

### 2.1 The Welcome page on every launch — P1 · S

**Observed.** `view` starts as `'landing'` on every load (`src/App.vue:396`), so returning players always land on a marketing-style page with a hero headline, a "01 / 02 / 03" feature row and "Enter the village".

**Correction.**

- If a save exists, open straight into the village.
- Show the landing page only on the very first launch, and make it short: the game name, one sentence and **Play**.
- Remove the numbered feature cards. The tour or tips cover that content in context.

### 2.2 "Welcome" as a main tab — P1 · S

**Observed.** The top bar has three tabs: Welcome | Village | Mine. On a phone, Welcome takes a third of the top bar and has no use after the first minute.

**Correction.** Keep only two destinations, **Village** and **Mine**. Move the intro and the village tour into a Help entry (a "?" icon next to Settings).

### 2.3 Too many ways to switch screens — P1 · M

**Observed.** Getting between village and mine is possible through:

- the top tabs
- the ✕ in the village ("Exit full screen village", `TownView.vue:55`)
- "Back to village" (`App.vue:129`, and inside the phone details panel at `MobileGameHeader.vue:88`)
- "Go mining" / "Mine" in the next-step card
- the "Mine Level 1" label on the map

The ✕ is the most confusing: ✕ normally means "close", and players cannot predict where it takes them.

**Correction.**

- **Village → Mine:** one primary button ("Play level 1") in the bottom panel, plus tapping the mine on the map.
- **Mine → Village:** one back arrow in the top-left corner of the mine screen, on every screen size.
- Remove the full-screen ✕. Make the village full screen by default. If a "show the whole page" mode is still needed, use a clearly labeled expand/collapse icon.
- Keep the top tabs on desktop only, or remove them once the two buttons above exist.

### 2.4 "Back to village" hidden on phones — P1 · S

**Observed.** On 390×844 the only way back from the mine is the top tab bar. "Back to village" sits inside the collapsible level header (`MobileGameHeader.vue:2`, `<details>`), behind a chevron.

**Correction.** Put a visible ← (back) button in the phone mine header, left of the level number. Keep the details panel for stats only.

---

## 3. Village screen

### 3.1 About 20 controls on first launch — P1 · M

**Observed at 1280×800 on a new profile.**

- Top-left: ✕, book (story) and eye (labels) icons, with no visible text.
- "0/22 built" and hammer "0" counters.
- Top-right: "Available plots →", a coin pill and "Hide progress".
- Bottom-left: five camera buttons (zoom out, zoom in, rotate left, rotate right, reset).
- Bottom panel: a stats row (water, food, people, happiness, era progress), the next-building card with Build and Mine buttons, and a gift row with six dotted boxes and a TNT icon.

**Why it matters.** Nothing tells the eye where to go. The one thing a new player needs — build the well, then go mining — competes with twenty others.

**Correction. Progressive disclosure:**

- **Always visible:** coins (top-right), the next-step card with one primary button, Settings and Help.
- **Shown only once relevant:**
  - hammers, from the first hammer earned
  - water and food, from the first building that provides them
  - people and happiness, from the first home
  - town upgrades, from the first era upgrade
  - the story book, from the first story entry
- **Camera buttons:** hidden on touch devices (drag and pinch already work). On desktop, collapse them into one "view" icon, and keep the keyboard shortcuts.
- **Labels toggle:** move it into Settings.
- **"0/22 built":** move it into the Available plots list header.

**Done when.** A new player's first village screen shows no more than about six controls, and the suggested building is the most prominent element.

### 3.2 Eleven identical "Build" pills on the map — P1 · M

**Observed.** Every empty plot shows a large blue pill: "Home Build", "Farm Build", "Well Build", "Saloon Build"… (`TownScene.vue:172`). They look equally important. The suggested plot (Well) only has a slightly thicker outline.

**Correction.**

- Empty plots get a small, quiet marker: a "+" or the building's icon at low emphasis. The name appears on hover (desktop) or on first tap (touch).
- The **suggested** plot gets the only prominent pill: a warm color, the building name and a gentle pulse (no pulse with reduced motion).
- Affordable plots can show a small coin check. Unaffordable plots stay quiet.
- Keep the full list available through "Available plots" for players who prefer a list.

### 3.3 A stats row made of unlabeled zeros — P1 · S

**Observed.** On a new profile the bottom bar shows `💧0  🌾0  👥0  🙂0%  🧭 0/76`. The `aria-label`s carry the meaning ("Water: 0/0"), but sighted players only see bare numbers.

**Correction.**

- Hide each stat until it is non-zero or relevant (see 3.1).
- When shown, add a short visible label or a capacity format: "Water 6 / 0 needed".
- Tapping a stat already opens its details. Add a hover tooltip on desktop so this can be discovered.

### 3.4 Building something free takes two confirmations — P2 · M

**Observed.** Bottom panel **Build** → a dialog with the picture, "Water capacity 0 → 6" and a second primary button, **Start building — Free** → the Well is built.

**Correction.**

- If the building is free or instant, the bottom-panel button builds directly and shows a small toast ("Well built — water for 6 people"), with Undo for a few seconds.
- If it costs coins, keep the details dialog. Its primary button should state the price ("Build for 75 coins").
- On a map tap, open the details, since the player asked for information.

### 3.5 The "Hide progress" button is far from its panel — P2 · S

**Observed.** "Hide progress" (`TownView.vue:245`) sits in the top-right corner, while the panel it collapses is at the bottom of the screen.

**Correction.** Put a collapse handle (a grab bar or chevron) on the top edge of the bottom panel itself, and remove the separate button.

### 3.6 The gift row can't be read — P2 · S

**Observed.** "A chest each puzzle / Next chapter gift", six small dotted boxes and a TNT image (`JourneyProgress.vue`). The dotted boxes don't look like progress.

**Correction.** One line: TNT icon + **Chapter reward in 6 puzzles**, with a thin progress bar or six filled/empty pips in the same style as other progress in the game.

### 3.7 The village tour covers the village — P1 · M

**Observed.** On first entry, a modal "Village tour · 1/7" opens (`TownView.vue:687`, `TownTour.vue`). Its first step says "Tap a plot to begin" while the modal blocks every plot. The next six steps (mine funding, neighbors, happiness, growth, savings, supplies) explain systems the player hasn't met yet.

**Correction. Learn by doing with pointers on the real elements:**

1. Point at the suggested Well: "Build a well — your first building is free." The tip disappears once the player builds it.
2. Point at the Play button: "Play the mine to earn coins." It disappears when the player enters the mine.
3. Show every later tip the first time its system appears: happiness after the first home, raids and savings before the first raid, supplies after the first shop visit.

Keep the full tour in Help for players who want it. Store progress per tip in the save instead of a single `tourSeen` flag.

---

## 4. Mine screen

### 4.1 The level 1 guide explains too much — P1 · S

**Observed.** Before the first move, "New in this mine" (`ObstacleGuide.vue`) explains ice and then: "Swipe a bonus gem, or double-tap it to activate in place. A rainbow clears the swapped color, or the most common color when double-tapped. Toolbar powers trigger bonuses they hit; swapping two bonuses creates a fusion." (`ObstacleGuide.vue:74`).

**Correction.**

- Level 1: show one card, "Match 3 gems on frosted tiles to clear the ice", with the existing little diagram, and **Play**.
- Bonus gems: a short tip the first time one appears on the board ("You made a bonus gem! Swipe it to set it off").
- Fusion: a tip the first time two bonus gems are next to each other.
- Toolbar powers: a tip the first time the player owns one.
- Mention "no move limit" once here (see 1.3).

### 4.2 The board is small and the stats take over — P1 · M

**Observed at 1280×800.** The board is about 365 px wide inside a much larger frame. The left sidebar is taken by the large "0 pts" score card with a bar to 7,500, "PLAY TIME 0:00 ≤ 2:34 · 1 bonus", "BEST CASCADE ×1", and — at the bottom, smallest — the actual goal.

**Why it matters.** The board and the goal are what the player acts on. They should dominate.

**Correction.**

- Size the board to the available height. At 1280×800 it should be roughly 560–620 px.
- Replace the sidebar with a slim bar above the board:
  `[← Village]  Level 1 — First light          [ice] 0 / 32          ⭐ 0   ⏱ 0:00   [?] [💡]`
- Score and time chest targets appear as small chest icons that light up while the target is still reachable. Put the details in a tooltip or the pause menu.
- Show best cascade on the victory screen only.

### 4.3 Five greyed-out power-ups at zero — P2 · S

**Observed.** A new player sees five disabled power-up buttons (Clear Row, TNT, Color Wand, Shuffle, Tile Breaker), each showing "0" (`PowerUpBar.vue:8`). On a phone, the text labels disappear and only the icons remain.

**Correction.**

- Show only the power-ups the player owns. If they own none, show nothing, or one quiet "Power-ups" slot that explains how to earn them.
- On a phone, long-press shows the name and effect. The first time a power-up is earned, show its name under the icon.

### 4.4 Phone mine header — P2 · S

**Observed.** The phone header is a `<details>` summary: LEVEL 01, SCORE 0, REWARD (chest ✓), ICE & STONE 0/32 and a chevron. Settings, mute and "Back to village" are hidden inside it. A separate status line below repeats "32 · Explore the seam · No move limit" and "LEVEL 01 · First light".

**Correction.**

- One header row: ← back · level number · goal icon with count · pause/menu.
- The menu holds settings, mute, help and restart.
- Delete the duplicate status lines (see 1.6).

### 4.5 Checked and not an issue: hint button

The "Show next move" button was disabled only while the guide dialog was open (`App.vue:245` disables it while input is paused). It was enabled once the board was playable. No change needed. A first-time hint after about 10 seconds without a move would still help new players.

---

## 5. Settings

### 5.1 Settings content — P2 · S

**Observed** (`SettingsDrawer.vue`): an uppercase "MAKE IT YOURS" heading, "A moment of calm", an intro line, backup export/import, music and sound sliders, reduced motion, high contrast, audio credits, a "PLAY YOUR WAY" keyboard guide and "Reset progress for testing".

**Correction. Order by how often each is used:**

1. **Sound:** music and effects sliders.
2. **Accessibility:** reduced motion, high contrast.
3. **Backup:** save and load a backup file (plain wording, see 1.7).
4. **About:** audio credits, and a Help link that holds the keyboard guide and the tour.

Remove the heading, intro and testing reset from player builds (see 1.1 and 1.7).

---

## 6. Visual consistency (P3)

- **Two themes with no transition.** The village uses a light parchment theme and the mine a dark purple one. Both are fine, but the switch is abrupt. A short shared transition (a mine-entrance fade) and a consistent top-bar layout in both themes would help them feel like one game.
- **Buttons.** On the first screen, the landing page, tour, next-step card and building dialog all use the same large dark-green button. Keep one primary button per screen and make the rest secondary or text buttons.
- **Icon-only buttons.** Every icon-only button needs a visible tooltip on desktop, not just an `aria-label`. This applies to the village top-left icons and the mine tools.
- **Numbers.** Use one format everywhere ("0 / 32", with thin spaces or none, consistently) and plain words instead of symbols (×1, ≤, ✦).

---

## Proposed layouts

### Village, first launch (desktop and phone)

```
┌───────────────────────────────────────────────┐
│ Prospect Hollow                  🪙 0   ⚙  ?  │
│                                               │
│            (3D village, full height)          │
│                                               │
│      · +   · +    [ 💧 Build a well — free ]  │  ← only highlighted plot
│         · +     · +                           │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ [well art]  Next: Well · Free   [ Build ] │ │  ← one primary action
│ │                                 Play mine │ │  ← secondary
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

### Mine, level 1 (desktop)

```
┌───────────────────────────────────────────────┐
│ ← Village   Level 1 — First light   [ice] 0/32│
│                               ⭐ 0  ⏱ 0:00 ? 💡│
│        ┌─────────────────────────────┐        │
│        │                             │        │
│        │        board (large)        │        │
│        │                             │        │
│        └─────────────────────────────┘        │
│              [owned power-ups only]           │
└───────────────────────────────────────────────┘
```

---

## Suggested order of work

| Phase               | Items        | Effort | Result                                                                 |
| ------------------- | ------------ | ------ | ---------------------------------------------------------------------- |
| 1 — Copy pass       | 1.1–1.7, 5.1 | S      | Removes most of the "generated" feel with no layout risk               |
| 2 — Navigation      | 2.1–2.4      | S–M    | Returning players land in the village; one clear way in each direction |
| 3 — Village clarity | 3.1–3.6      | M      | First screen shows about six controls and one obvious next step        |
| 4 — Mine layout     | 4.2–4.4      | M      | Large board, goal first, no dead power-up buttons                      |
| 5 — Teaching        | 3.7, 4.1     | M–L    | Pointers and first-time tips replace the up-front modals               |
| 6 — Polish          | Section 6    | S      | Consistent buttons, tooltips, numbers and theme transition             |

## Verification checklist for each phase

- `npm run verify` passes (format, tests, build).
- `testing/chapter-progression.test.js` passes unchanged, including matching past 100 moves. No UI change adds or implies a move cap.
- Every new or changed string has a French entry in `src/i18n/fr.json`.
- Manual pass at 1440×900, 1280×800, 390×844, 320×568 and 844×390 landscape, in English and French, with reduced motion and high contrast.
- A new profile reaches "Well built" and "Level 1 started" with no modal in the way, and without needing to read more than one sentence at a time.
- A returning profile opens in the village and reaches the mine in one tap.
- Screen reader names still exist for every control whose visible label was removed.
