# Buildings and mine upgrades through the eras

Prospect Hollow has fifteen playable eras, from Frontier Settlement to Twin
Hollows. The [settlement guide](../settlement-eras.md) lists them in order and
explains how to load a disposable town for review.

Every Frontier building has three completed stages. Later eras modernize existing
buildings in three stages while preserving their services until the new work is
finished. The mine's permanent surface works follow era transitions; underground
mechanics and chapter equipment follow puzzle progress independently.

The old eight-era stage-image galleries were retired in October 2026. They showed
earlier building definitions, including five-stage Frontier landmarks, and repeated
every stage alongside comparison sheets. Use the running game and current content
definitions for stage counts and appearance.

## Current references

- [Era architecture](../era-architecture.md): visual capabilities, shared renderers,
  mine assembly and extension checks, including Canopy and Riverlight.
- [Tomorrow City gallery](../tomorrow-city-gallery.md): rounded domes, pods and transport.
- [Later eras](../future-eras.md): Skysail through Twin Hollows, the Skyward quarter,
  space elevator and Moon settlement.
- [Airport art](../airport-art.md): terminal layouts and aircraft activity.
- [The floating seam](../hollow-mine-levels.md): current underground mechanic recordings.

## Reproduce a building review

Start Vite in Docker using the [readme](../../readme.md#run-locally), then open
`/scripts/era-art-review.html`. Select an era and export its browser-rendered PNG
data to `output/era-art-data/<era>.json`. The review uses production renderers and
real plot positions, with neutral scenery and consistent viewpoints.

The packager processes whichever era JSON files are present, including later
architectural families. Remove superseded JSON exports before packaging; it
replaces its previous generated review directory.

```sh
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/app -w /app python:3.13-slim python scripts/package-era-art-review.py
```

It writes PNGs and Markdown galleries beneath `output/era-art-review/` and a ZIP
at `output/prospect-hollow-era-upgrades.zip`. Review packages stay ignored. Commit
selected current captures only when a maintained guide needs them.
