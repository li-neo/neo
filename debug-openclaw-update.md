# Debug Session: openclaw-update

Status: [OPEN]

## Symptom

- `openclaw update` fails during npm-based global update.
- Observed runtime includes `Node.js v25.5.0` and `npm 11.12.1`.
- Error surface includes `MODULE_NOT_FOUND` from npm execution path.

## Initial Hypotheses

1. `Node 25` and/or `npm 11` is incompatible with OpenClaw's global update flow.
2. The global package under `/opt/homebrew/lib/node_modules/openclaw` is partially corrupted or has missing files.
3. The npm executable or its bundled internal modules are damaged, causing update-time module resolution failure.
4. The `openclaw update` command invokes an entry path that assumes a different installation method than the current global package manager layout.
5. PATH or symlink resolution points `openclaw`, `node`, and `npm` to mismatched installations.

## Evidence Plan

- Read npm debug log for the precise missing module and failing stack.
- Inspect `openclaw`, `node`, and `npm` installation paths and versions.
- Reproduce failure with a controlled npm global install/update command.
- Repair the smallest failing layer, then verify `openclaw --version` and update path.

## Evidence Collected

- `which node` -> `/opt/homebrew/bin/node`
- `which npm` -> `/opt/homebrew/bin/npm`
- `node -v` -> `v25.5.0`
- `npm -v` -> `11.12.1`
- `/opt/homebrew/bin/openclaw` was a broken symbolic link to `../lib/node_modules/openclaw/openclaw.mjs`
- `/opt/homebrew/lib/node_modules/openclaw/package.json` was missing
- `/opt/homebrew/lib/node_modules/openclaw` contained only an empty shell plus nested `node_modules`
- npm registry access was healthy and `npm view openclaw version` returned `2026.4.15`

## Analysis

- Hypothesis 1 (`Node/npm` compatibility) remains possible as a trigger, but it is not required to explain the current failure.
- Hypothesis 2 (global package corruption) is confirmed.
- Hypothesis 3 (npm self-corruption) is rejected because npm successfully queried registry and reinstalled the package.
- Hypothesis 4 (update flow mismatch) is plausible as an upstream trigger, but not needed for repair.
- Hypothesis 5 (PATH mismatch) is rejected for `node`/`npm`; the issue was the `openclaw` target itself.

## Repair

1. `npm uninstall -g openclaw`
2. `npm install -g openclaw@latest`

## Post-Fix Verification

- `test -f /opt/homebrew/lib/node_modules/openclaw/openclaw.mjs` -> `OK`
- `openclaw --version` -> `OpenClaw 2026.4.15 (041266a)`
- `openclaw update` -> `Update Result: OK`

## Current Status

Status: [AWAITING_USER_CONFIRMATION]
