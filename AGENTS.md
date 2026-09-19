# Agent Working Guide

## Start here

1. Inspect state before changing anything: `git status`, current branch, and divergence from
   `origin/staging` and `origin/main`. Fetch first; do not modify files during preflight.
2. Start each discrete feature or fix from freshly fetched `origin/staging` on its own
   `sjoly/` branch. Resume an existing task on its existing branch instead of creating a duplicate.
3. Run simultaneous coding tasks in separate worktrees so they never share a checkout.
4. Read [project context](#project-context) and the docs relevant to the task.

## Project context

- `README.md`: what the app does, features, compatibility.
- `client/src/ofx/processor.ts`: all OFX cleaning logic (replacements, truncation, tag removal). Runs in the browser.
- `client/src/ruleStore.ts`: browser-local rule storage and validation.
- `server/src/index.ts`: static host + `/health` only; there is intentionally no upload endpoint.
- `client/src/`: React UI.
- `Dockerfile`: multi-stage build; Dokploy builds this on deploy.
- `docker-compose.yml`: local container run.

## Branch and deploy model

The release path is:

`origin/staging → sjoly/ feature branch → PR → staging → end-to-end QA → authorized staging-to-main PR → production`

- **Feature PRs target `staging`.** **Release PRs promote `staging` to `main`.** Never commit
  directly to `staging` or `main`.
- Dokploy is the only deployment owner. Pushing to a branch triggers its deploy automatically:
  - `staging` branch → **Money 99 Staging** (`staging-money-99-savior.stephenjoly.net`)
  - `main` branch → **Money 99 Production** (`money-99-savior.stephenjoly.net`)
- Pull requests get disposable preview deployments (collaborator-only, max 3).
- GitHub Actions only validates the Docker build; it does not deploy.
- Do not fast-track a feature directly into `main`, and do not promote individual commits outside
  this path. Production promotion requires the owner's authorization.

## Working rules

- Complete the authorized task; use focused, task-scoped commits and preserve others' changes.
- Inspect `git status` and stage only task-scoped paths before committing. Exclude secrets,
  generated outputs, and unrelated changes.
- Push meaningful checkpoints to the matching remote feature branch, including before pausing,
  handing off, or ending a task. A checkpoint push is not approval to merge.
- Verify the push succeeded and the remote branch contains the checkpoint. Never claim the remote
  contains unsaved edits; report any uncommitted, unpushed, or failed work explicitly.
- Open a draft PR against `staging` early.
- Before pushing, review `git diff origin/staging...HEAD --name-only` and update affected docs.
- Do not force-push over another task's commits; never reset or discard unfinished work.

## Validation

- Build the image before pushing: `docker build -t money-99-savior:local .`.
- Smoke-test the container: run it and check `/health`; then verify a file in the browser, since processing happens client-side.
- Run the checks before pushing: `npm test` (client vitest suite), `npm run typecheck`, and `npm run lint`. CI runs all three before the Docker build.
- Add or update tests in `client/test/` when changing OFX processing behavior.
- OFX processing must stay dependency-free and browser-only: never add a server upload path or send statement data over the network.
- Report failures and environment limits honestly rather than claiming success.

## Handoff and retirement

- At a pause or handoff, record the branch, worktree path, latest pushed commit, PR/preview link,
  checks run, known failures, remaining work, and any local-only changes.
- After merge, retire the merged branch and worktree, preserving active or dirty work.
- Never delete `staging` or `main`.
