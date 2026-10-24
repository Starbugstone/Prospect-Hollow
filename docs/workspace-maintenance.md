# Workspace maintenance

Keep current behavior in the [documentation index](README.md). Move completed plans
and dated handoffs to [history](history/README.md), label their original revision and
link the current implementation guide. Historical counts and measurements should
remain attached to their original context.

## Images and captures

Keep a committed image or video when a current guide uses it to explain the game
or verify a mechanic. Replace superseded captures and update every Markdown and
HTML reference in the same change. Keep source artwork under `art/`, `src/assets/`
and `public/art/`; an unreferenced filename alone does not establish that runtime
or authoring artwork is unused.

Raw recordings, alternate renders, contact sheets, demo saves and downloadable
review packages belong under ignored `output/`. The era review packager writes
there, leaving maintained documentation unchanged. Export only selected captures
needed by a current guide into `docs/images/`.

## Local files

Inspect sizes and contents before deleting generated directories:

```sh
du -h --max-depth=2 . | sort -hr | head -40
git status --short
git clean -ndX
```

`output/`, `.playwright-cli/`, `dist/`, `node_modules/.vite/` and
`backend/var/phpstan/` are disposable once any useful uncommitted scripts or patches
have been saved elsewhere. Checks and browser reviews recreate their own output.
Keep installed dependencies needed for development; they are reproducible with
`npm ci` and Composer in Docker when a full reinstall is needed.

Do not apply `git clean -fdX` indiscriminately: ignored files also include local
configuration, database backups and generated runtime mesh chunks. Do not remove
database volumes as part of a cache cleanup. Inspect project-specific Docker
containers before removing obsolete previews; other projects share Docker.

## Dependency audits

CI audits both lockfiles: `npm audit --audit-level=moderate` in the frontend job and
`composer audit` in the backend job. The npm audit covers development tools too
(Vite, Vitest, knip and their dependencies), since they run on contributor machines
and in CI. Moderate is the threshold because development-server advisories are often
rated moderate; low findings are reported without failing the run. Run it locally in
Docker with the frontend prefix from `AGENTS.md`, adding `--omit=dev` to check only
what ships to players:

```sh
npm audit --audit-level=moderate
npm audit --omit=dev
```

Fix a finding with the smallest in-range update, such as `npm update vite vitest` or
`npm update <transitive package>`, staying on the current major line. Raise a
`package.json` range or bump the package that pulls in a transitive dependency only
when the lockfile cannot reach the patched version otherwise, and use `overrides` only
when no fixed upstream release exists. Then run `npm run verify`.

## Worktrees

```sh
git worktree list --porcelain
git -C /path/to/worktree status --short --branch
git log preprod..worktree-branch --oneline
git cherry preprod worktree-branch
```

Check that no active session is using the worktree. Preserve uncommitted files and
unique commits before removing the checkout with `git worktree remove`.
A clean checkout can still contain unmerged commits: keep its branch until that
work is deliberately integrated or discarded. Then run `git worktree prune` and
confirm only the intended checkouts remain. Git history retains deleted tracked
images; removing obsolete files does not require rewriting shared history.
