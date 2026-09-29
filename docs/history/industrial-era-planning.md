# Industrial / Electric Town: accepted design

Implemented on `docs/industrial-era-planning`, based on Develop, including `c990cca` (River & Rail's three-tier upgrades, transport and raid fixes).

## Direction: First Lights

Industrial follows River & Rail in 1908. Electricity is the main milestone: completing the power house lights the square and main streets and opens electric modernization. A saved, dismissible First Lights story marks the occasion. There is no fuel inventory, wiring puzzle or maintenance bill.

The existing town evolves in place. Its river, steamboat, railway, services and funded progress persist. Every plot must reach all three era levels before the era is complete. River & Rail uses the same rule, inherited from Develop: all 29 plots must finish their third era level before Industrial becomes available. Industrial has 33 plots, all required. Later eras remain disabled.

## Buildings and visible progression

| Project                      | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| Power house                  | Electric lamps and modernization access                                 |
| Fire station                 | Increasing protection from workshop-fire coin losses                    |
| Row houses                   | Six, twelve, then sixteen additional resident places                    |
| Light mill                   | Working industrial district beside the river                            |
| Main town well modernization | Twenty additional water places at Industrial level three                |
| Every existing plot          | Three substantial architectural upgrades, retaining functional services |

Industrial level one replaces old buildings with brick civic, residential, workshop, station, quay or utility architecture. Level two adds substantial wings and shelters; level three adds larger civic structures, towers, utility lamps or bridge trusses. Both the 3D village and SVG fallback show these stages. River & Rail keeps Develop's brick/slate, extension and tower evolution.

The power house and fire station can be built immediately. The station can begin modernization before electricity; other older buildings require power house level one. Row houses and the mill also require electricity, and the mill requires the existing bridge.

Each Industrial plot costs 1,200, 1,600 and 2,000 coins across its three levels: 158,400 coins for the whole era. Normal puzzle completions advance funded projects concurrently; builder hammers retain their existing role. Services remain available during modernization.

## Village interactions

The extra interactions are now implemented, following approval to implement the ideas:

- Frontier retains mounted bandits and existing defense/bounty rules.
- River & Rail gets cargo theft around the freight yard once transport is built. The police and bank protect savings and can earn the existing capture bounty.
- Industrial gets small workshop fires once the power house or mill operates. Crews approach the workshop and extinguish the fire. Buildings are never destroyed. Losses are capped at 30 coins and protect the last 50 savings. Fire station levels protect two thirds, five sixths and finally all coins at risk. Fires do not pay capture bounties.

New River & Rail and Industrial events use a saved gap of 6–14 normal puzzle completions. They do not accumulate while offline. The town bell can reduce the remaining loss; opening ready defenses can refund the appropriate loss during an encounter. Skipping, replaying or reloading cannot settle the same receipt twice. Existing saved bandit receipts retain their original identity.

## Fresh mining content

Industrial adds 48 authored puzzles in eight six-level chapters: Lantern Works, Copper Galleries, Crystal Powerhouse, Signal Galleries, Brickworks, Waterworks, Dynamo Halls and Illuminated Vaults. The campaign now has 120 levels in 20 chapters, with new backdrops and English/French text. These chapters use existing obstacles and objectives; a new lantern board mechanic remains a future idea.

The original eighteen-level estimate was insufficient for the approved requirement to upgrade every building three times. A deterministic hint-driven sample of the 48 new levels with seeds 1, 19 and 73 yielded about 367,000–461,000 mining coins including leftover bonuses, before chests and town income. This is a funding sanity check, not a human pacing study. Construction, optional rewards and individual play speed still need player feedback.

## Deferred ideas

Streetcars, day/night cycles, printing offices and additional mine mechanics are outside this implementation. Electricity remains a one-time civic milestone. The next era needs its own content and approval before being enabled.

See [settlement eras](../settlement-eras.md) for fixtures and verification.
