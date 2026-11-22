# Museum continuous replay and saved rewards

Start a fresh runner stack and pass doctor. The browser imports a local save with a
built museum and workshop and three played levels.

Run `bash scripts/verify-gameplay.sh run "$RUN" continuous-navigation`. The check
lives in `testing/browser/continuous-navigation.cjs`.

1. Open `/play`, then More → Museum → Continuous play. Filter for unfinished
   levels and select **Next unfinished level**. The museum opens level 2.
2. Supply committed-move counters and check that the mine shows 25/25 coins and
   291/900 workshop gems. In English and French, verify that the controls fit at
   320, 360, 844 and 1280 pixels and that the phone banner clears the board.
3. Hold a move animation and check that **Next level** and **Exit mine** are
   disabled. Release it and select **Next level**. The previous run ends and
   credits the record before exactly one new run starts on level 3.
4. Exit the mine and reload. The level 2 record still has 291 workshop gems and
   a score of 777.

The save and move counters are synthetic. The checks cover the replay controls,
record handoff and local persistence. The browser closes automatically.
The log is `continuous-navigation.log`. The report and screenshots are in
`artifacts/continuous-navigation/` and survive the shared stack cleanup.
