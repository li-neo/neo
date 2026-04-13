# Debug Session: local-build-runtime

Status: OPEN

## Symptom

- User reports sandbox compile often fails.
- User suspects local direct compile may be colliding with internally started services.
- User reports there is another current error.

## Hypotheses

- H1: Multiple frontend or backend dev servers are running at the same time, causing port conflicts or stale process reuse.
- H2: The sandbox build is fine, but local dev mode fails because `.next` cache or local runtime logs are stale/corrupted.
- H3: Frontend and backend are each bound to expected ports, but one of them is a zombie or broken hot-reload parent process.
- H4: The current error is caused by mixed environments: one process uses an old virtualenv/dependency state while another uses the updated code.
- H5: The failure is not compilation itself, but runtime fetches hanging because the backend process is unhealthy.

## Plan

- Inspect listening ports, process tree, and recent runtime logs.
- Compare frontend and backend health endpoints.
- Confirm which hypothesis matches the current machine state before any code change.
