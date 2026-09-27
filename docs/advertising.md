# Advertising and privacy preparation

This implements the local preview and integration foundation for [#43](https://github.com/Starbugstone/Prospect-Hollow/issues/43) and [#50](https://github.com/Starbugstone/Prospect-Hollow/issues/50). Real advertising is disabled by default. Account access, the production CMP configuration, provider confirmation and a tracker audit remain required before release. This is not a claim of GDPR compliance.

## Try the placeholders

```sh
VITE_ADS_ENABLED=true VITE_AD_PROVIDER=mock VITE_PRIVACY_PROVIDER=placeholder npm run dev
```

The English/French privacy dialog offers equally prominent Reject all, Manage choices and Accept all actions. Its preference is only for the local preview; it never authorizes an external advertising SDK. Settings → Privacy choices reopens it. Necessary game saves, account sessions and privacy preferences continue to work when advertising is refused. No separate analytics toggle is offered because GameMonetize's independently controllable analytics behavior is unconfirmed.

After accepting the preview:

- Finish a normal puzzle and settle its earned chests. **Watch ad · Bonus chest** opens a clearly labeled local placeholder with completion, dismissal, no-fill and error outcomes. Successful completion creates one persisted `source: 'ad'` receipt through the existing chest presentation/recovery path.
- With no stored Shuffle, an active normal puzzle with legal moves can offer **Watch ad · Shuffle**. Completion shuffles immediately, without granting an inventory item. Stored shuffles retain priority.
- Finish level 6, 12 or any subsequent chapter boundary and choose Continue mining. A single interstitial opportunity occurs before the next chapter. Returning to the village defers it until the next chapter is explicitly started. The receipt is consumed before the request, including when ads are disabled or unavailable. Replays and continuous play create no opportunity.

Dismissal, no fill and errors grant no reward. The service never changes campaign state. Callers verify the town and run identity again after asynchronous completion. Consent withdrawal cancels pending advertising. Existing earned rewards are retained. Fullscreen presentations pause input and the optional active-play clock, and mute audio without changing saved volume preferences.

`src/data/advertising.js` centralizes the minimum chapter (1), chest cap (3 per local day per town), shuffle limit (one per run) and small coin fallback (25). Ad chests otherwise contain one puzzle supply, never builder hammers. They do not advance construction or campaign progress and do not affect normal chest pity rules. Receipts and limits travel with the town save. These local game receipts are not server-verified advertising claims or fraud protection.

Unlimited puzzle moves, normal rewards, optional speed targets and automatic free dead-board recovery are unchanged. Advertising timeouts limit SDK operations only; they never fail or restart a puzzle.

## CMP choice and configuration

Cookiebot is the selected vendor adapter. Google lists Cookiebot as a certified CMP with ID 134 on its [CMP requirements page](https://support.google.com/admanager/answer/13554116?hl=en). The integration follows Cookiebot's [developer API](https://www.cookiebot.com/en/developer/) and [current TCF integration guide](https://support.cookiebot.com/hc/en-us/articles/360007652694-Cookiebot-CMP-and-the-Transparency-and-Consent-Framework-TCF), including the current `data-framework="TCF"` attribute. Certification alone does not configure the site or establish compliance.

The live adapter requires an actual Cookiebot domain group, TCF enabled for the registered domains, an English/French banner with equivalent acceptance/refusal, a configured vendor inventory, and `VITE_PRIVACY_CONFIGURATION_REVIEWED=true`. It restricts vendors/purposes before injecting the CMP and disables Consent Mode injection. It only allows ads after explicit Cookiebot marketing consent plus a loaded TCF callback containing the consent string and every configured purpose/vendor consent. Unknown, partial, failed and unsupported states keep advertising blocked, including outside the configured GDPR path. The preview preference can never satisfy this gate.

Configure these public build-time settings using `.env.example` as a template:

| Setting                               | Meaning                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `VITE_ADS_ENABLED`                    | Global switch, default `false`                                           |
| `VITE_AD_PROVIDER`                    | `none`, `mock`, or `gamemonetize`                                        |
| `VITE_PRIVACY_PROVIDER`               | `placeholder` or `cookiebot`                                             |
| `VITE_COOKIEBOT_DOMAIN_GROUP_ID`      | Actual registered Cookiebot domain group UUID                            |
| `VITE_PRIVACY_CONFIGURATION_REVIEWED` | Explicit deployment/configuration review gate                            |
| `VITE_PRIVACY_VENDOR_IDS`             | Comma-separated, provider-confirmed IAB vendor IDs, including Google 755 |
| `VITE_PRIVACY_GOOGLE_AC_VENDOR_IDS`   | Provider-confirmed Google Additional Consent vendor IDs, if used         |
| `VITE_GAMEMONETIZE_GAME_ID`           | Actual approved game ID; placeholder strings are rejected                |
| `VITE_GAMEMONETIZE_APPROVED`          | Self-hosted integration approved for this game/domain                    |
| `VITE_GAMEMONETIZE_PRIVACY_REVIEWED`  | Complete provider/CMP/runtime review recorded                            |

These are public identifiers and feature gates, not secrets. Changing Vite environment settings requires restarting development or rebuilding deployment.

## SDK limits and release follow-up

Issue #50 supersedes #43's initial Google H5 choice for the web provider. The [official GameMonetize SDK documentation](https://github.com/MonetizeGame/GameMonetize.com-SDK/blob/master/README.md), linked from [GameMonetize's SDK page](https://gamemonetize.com/sdk), documents `showBanner`, `SDK_READY`, `SDK_GAME_PAUSE` and `SDK_GAME_START`. A generic resume event does not prove rewarded completion. Consequently, GameMonetize rewarded placements remain unavailable until the provider supplies a verified rewarded contract. Only the mock provider can complete rewarded previews. Native AdMob/H5 adapters are not installed or presented as implemented.

The GameMonetize interstitial scaffold runs in a disposable same-origin iframe so withdrawal can destroy its execution context, instead of merely removing a script while its timers survive. The provider must confirm this embedding and consent API bridge; this is not yet a tested production integration. Removing that context cannot revoke already transmitted data or erase third-party storage.

The packaged server's restrictive CSP in `backend/public/.htaccess` intentionally remains unchanged. It blocks external CMP and ad origins. An audited, narrowly scoped production allowlist is still required for scripts, frames, connections, media and any other observed resources; do not replace it with wildcards. The SDK must not receive permission through an unconditional HTML script or preconnect.

Before switching on live advertising, record:

1. GameMonetize's self-hosted approval and the actual Game ID; how it consumes TCF/Additional Consent; complete Google/downstream vendors; cookies/storage and retention; analytics behavior and independent disabling; controller/processor roles and applicable agreements; explicit rewarded availability/completion/dismissal events.
2. CMP account/domain configuration, vendor purposes and legal bases, rejection/withdrawal behavior, English/French text, current vendor lists and the production privacy/cookie notice. Include cookies and similar technology, device/IP/browser information, page/game context, advertising interactions, personalization/measurement and any analytics actually present. Final controller/contact, retention and data-rights information must come from the operator's real deployment.
3. Clean-browser network/storage captures before consent, after reject, after accept, after an interstitial, after a rewarded completion/dismissal and after withdrawal/reload. Before accept and after refusal there must be no GameMonetize, IMA, DoubleClick/Ad Manager, bundled Analytics or auction-vendor requests.
4. Correct audio/input restoration, offline/no-fill/error/timeout handling, desktop/mobile behavior and exactly-once rewards. Consent alone or generic resume callbacks must never grant a reward.

The full provider questions and audit checklist remain in issue #50. Keep both issues open until their production/native acceptance criteria have been completed.

## Verification

`npm run verify` covers source formatting, generated footprints, all game/service regressions and production bundle budgets. The advertising suites exercise duplicate and stale callbacks, withdrawal during completion, timeouts, failed receipt saves, reload/import recovery, bounded rewards and free dead-board recovery. `testing/chapter-progression.test.js` retains completion beyond 100 moves after the optional speed target.

With the mock development server running, browser regressions can be repeated using an installed Playwright runtime:

```sh
PH_TEST_ORIGIN=http://127.0.0.1:5174 node testing/browser/advertising.cjs
PH_TEST_ORIGIN=http://127.0.0.1:5174 node testing/browser/account-deletion.cjs
```

Set `PLAYWRIGHT_MODULE` if Playwright is installed outside this repository. The advertising script uses disposable browser contexts and verifies refusal, preferences, chest/shuffle completion and dismissal, chapter 6→7 no-fill, French mobile layout and no external requests. The deletion script uses a mocked API with real local/IndexedDB cleanup; actual API erasure is covered separately by `backend/tests/saves.php`. Screenshots are written to the ignored `output/playwright/` directory.

## Account deletion

Settings → Account & deletion opens the signed-in account controls. Deletion requires an explicit typed confirmation and a successful authenticated server response. It removes the account, cloud towns and history, public listings and sessions, then cleans this browser's account caches and recovery backups. Unrelated guest towns and settings remain. Exported files, other devices' offline copies, and deployment backups are separate; the UI must not promise remote erasure of those copies. Cleanup failures after successful server deletion must be reported as cleanup failures, rather than implying the account still exists.
