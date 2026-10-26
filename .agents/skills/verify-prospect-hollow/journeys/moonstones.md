# Moonstones: confirm sales and collect production

**Prerequisites:** fresh runner stack and passing doctor. The fixture seeds a local
Twin Hollows town: 1,000 coins, 42 held Moonstones, 57 lifetime earned, production
progress 2 and 12 stored. Elevator and all Moon lots are level 3. No account.
**Command:** `bash scripts/verify-gameplay.sh run "$RUN" moonstones`.
**Implementation:** `testing/browser/moonstone-resource.cjs`.

The intercepted `/moonstone-resource-test` mounts the real workshop component and
campaign store. Its collection cooldown is 30 seconds.

1. **Collect 12 moonstones** is disabled in the workshop; **Stored 12 / 30** is shown.
2. Click **Sell all**. The confirmation asks about 42 stones for 10,500 coins;
   balances remain unchanged. Click **Cancel**.
3. Click **Sell 10**: the receipt reports 2,500 coins; balances become 3,500 coins
   and 32 stones, with lifetime earned still 57.
4. Choose **Sell all**, then **Confirm sale**. Balances become 11,500 coins and zero
   stones; lifetime earned remains 57.
5. Mount the real Moon map with the same store and activate the **Moonstone workshop**
   label containing **Collect 12 moonstones**. Held stones become 12, lifetime earned
   becomes 69, stored production becomes zero and progress stays 2.

Inspect the serialized `crystal-cascade-profile-v3` device save, independently of
the reactive store: all final counters must match. The fixture reseeds on navigation,
so a page reload is not a persistence check here. The valley journey covers reload.
Cancelled confirmation must not sell anything; selling must not increase lifetime
earned. Uncaught page errors fail the check; this existing fixture does not assert
console-error silence.

Evidence: `moonstones.log`, `artifacts/moonstones/result.json`, `collected.png`.
Cleanup: the browser closes automatically, then use the shared stack cleanup.
