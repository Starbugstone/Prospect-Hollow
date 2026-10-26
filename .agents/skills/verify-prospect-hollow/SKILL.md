---
name: verify-prospect-hollow
description: Run Prospect Hollow's isolated Docker verification journeys for valley construction persistence, mine feedback, Moon controls, and Moonstone transactions. Use for gameplay or settlement verification and maintaining these recipes.
---

# Verify Prospect Hollow gameplay

From the repository root, run:

```bash
bash scripts/verify-gameplay.sh all
```

Read [the feature map](feature-map.md) for coverage and the relevant journey before
interpreting a result. The runner uses the existing standalone Playwright checks,
Node 24, software WebGL, and a fresh PostgreSQL database. All checks run in Docker.
No real accounts or external email are used. These journeys do not prove cloud
saving, email delivery, full campaign completion, or every settlement interaction.

`all` starts a fresh stack, migrates it, runs the read-only doctor, runs each journey,
and removes this run's containers, network and volumes even on failure. Docker image
caches and evidence under `output/verification/run-*` remain. A failed journey does
not stop the remaining journeys. A failed doctor blocks them all.

For inspection or a single journey:

```bash
bash scripts/verify-gameplay.sh start
```

Use the exact printed directory as `RUN` in subsequent commands:

```bash
bash scripts/verify-gameplay.sh doctor "$RUN"
bash scripts/verify-gameplay.sh run "$RUN" valley
bash scripts/verify-gameplay.sh cleanup "$RUN" --dry-run
bash scripts/verify-gameplay.sh cleanup "$RUN"
```

`start` keeps the stack, including on setup failure, for diagnosis. Always clean it
up afterward. Never substitute the production Compose project. Cleanup accepts
only a run owned by this checkout; do not remove its ownership marker or reuse an
old run for a clean-state verification. Shared build-image caches are retained.
Use a new run directory for a rerun after changes: per-journey logs and `results.tsv`
are replaced when `run` is repeated in the same directory.

Docker and Compose must be available, with network access for images and npm.
Dependencies have a per-run volume. Vite mounts this checkout and may regenerate
the ignored mesh chunks through the existing `predev` command. Avoid changing
source during a run. The backend image is built from this checkout before startup;
its `backend/src` is mounted read-only. Host ports are allocated by Docker and
printed by the doctor. Browser checks share Vite's network namespace and use
`127.0.0.1:5173`, so Web Locks work on a trusted localhost origin.

The doctor prints checkout, commit, source mounts, ports and backend schema readiness,
then opens the signed-out town and login form. It checks anonymous account rejection;
it does **not** authenticate an account. Gameplay fixtures are local browser saves.

Evidence includes `commit`, `status.txt`, `working-tree.patch` (including untracked
source), setup logs, `doctor.log`, per-journey logs, `results.tsv` and `artifacts/`.
Keep failed-run evidence. Report each journey as clean, changed, blocked, or a product
defect, with its run path and tested commit. Fix recipe drift or automation gaps here;
report product defects separately. Unexecuted or unreachable recipes remain drafts.

When the map changes, rerun the affected journeys from a fresh `start`, exercise
helper failures and cleanup's dry run, then confirm artifacts survived teardown.
Follow `AGENTS.md` for additional checks and delivery on the current branch.
