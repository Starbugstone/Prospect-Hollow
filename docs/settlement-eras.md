# Settlement eras

Fifteen eras are playable. The campaign has 546 puzzles in 91 chapters; town
advancement and mine progress are independent.

| Era                        | Year         | Saved id       |
| -------------------------- | ------------ | -------------- |
| Frontier Settlement        | c. 1865–1880 | `frontier`     |
| River & Rail Boom          | 1884         | `river-rail`   |
| Industrial / Electric Town | 1908         | `industrial`   |
| Post-war Rebuilding        | 1920         | `post-war`     |
| Motor Age                  | 1932         | `motor-age`    |
| Aviation & Radio           | 1958         | `aviation`     |
| Music & Television         | 1986         | `broadcast`    |
| Connected City             | 2005         | `contemporary` |
| Tomorrow City              | 2065         | `tomorrow`     |
| Canopy Age                 | 2100         | `canopy`       |
| Riverlight Age             | 2140         | `riverlight`   |
| Skysail Age                | 2185         | `skysail`      |
| Stargazer Age              | 2230         | `stargazer`    |
| Moonward Age               | 2270         | `moonward`     |
| Twin Hollows               | 2300         | `twin-hollows` |

`src/data/eras.js` owns the era definitions. Shared capability and renderer
contracts are documented in [era architecture](era-architecture.md). Tomorrow
City has a [visual gallery](tomorrow-city-gallery.md); the Skyward quarter,
space elevator and New Hollow are covered in [later eras](future-eras.md).

## Advancement and construction

Era advancement requires the available buildings to be complete, including all
three current-era modernization stages after Frontier. Pending construction and
unresolved encounters must be settled first. There is no mine-level gate.
Every Frontier building has three stages, including landmarks that formerly had
five; their final functional benefits are preserved.

Modernization retains existing services until construction finishes. Normal
puzzle completions, including museum replays, advance active projects. Continuous
play does not advance construction or Forge Charge. Builder hammers fund and
finish eligible projects instantly. See [town gameplay](town-demo.md) for services,
construction and rewards.

Transitions persist their receipt before presentation and use the shared cinematic
lifecycle. Reload, skip and reduced motion retain the saved result. Mine surface
upgrades follow the town era; puzzle layouts and chapter rewards remain separate.
No era adds move limits or a hard puzzle timer.

## Try an era immediately

Start Vite as described in the [readme](../readme.md#run-locally), then generate
fixtures in Docker:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:24-bookworm-slim npm run demo:eras
```

Fixtures live in ignored `output/era-demo/`. Use a disposable browser profile:
running a fixture's `.console.js` replaces that origin's progress and reloads it.

- `frontier-ready`: completed Frontier, ready for the first transition.
- `river-rail`, `river-rail-complete`: transition or completed second era.
- `industrial`, `industrial-lights`, `industrial-complete`: transition, First
  Lights presentation or completed Industrial town.
- Every later saved era id has `<id>`, `<id>-open` and `<id>-complete` fixtures:
  pending transition, ready to build and completed town.
- `cargo-theft`, `workshop-fire` and `storm-cleanup`: saved encounter states.

## Validation

Run `npm run verify` in Docker for formatting, lint, contracts, regression tests
and build budgets. Level playthroughs are separate: use `npm run test:levels` after
changing puzzle content or scoring. Check transition persistence, construction
completion, preserved services, encounters and reduced motion in a disposable
browser session. Earlier release reports are retained under [history](history/README.md).
