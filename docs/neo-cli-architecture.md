# NEO API / CLI / Skill Architecture

## Goals

- Standardize current API contracts without breaking existing web pages.
- Provide a local `NEO CLI` for all editable operations, configuration, and system lifecycle management.
- Add a reusable Trae Skill that manages the site through `NEO CLI`, not through ad hoc scripts.
- Keep admin control limited to the site owner by reusing admin JWT authentication.

## Current State Review

### Good Parts

- The backend already exposes versioned endpoints under `/api/v1`.
- Core resources are mostly resource-oriented: `projects`, `skills`, `posts`, `guestbook`.
- Read/write permission boundaries already exist for admin-only operations.
- The response envelope is already unified through `success()` / `error()`.

### Current Gaps

- Update semantics were `PUT`-only; third-party clients often expect `PATCH`.
- Operation surfaces are split between web UI, shell scripts, and backend endpoints.
- There is no single operator entry for content CRUD, startup, shutdown, health, and logs.
- CLI-grade authentication was not formalized; practical reuse path is the existing admin JWT.

## Compatibility-First API Optimization

### Principle

- Preserve current `/api/v1/*` endpoints to avoid web regression.
- Add compatibility improvements rather than large path rewrites in-place.
- Document a `v2` target shape while keeping `v1` stable.

### Applied Improvements

- `projects`, `skills`, `posts`, `guestbook` now support both `PUT` and `PATCH` for updates.
- This makes the API more compatible with REST clients and future CLI patch-style operations.

### Recommended V2 Shape

#### Public Read APIs

- `GET /api/v2/projects`
- `GET /api/v2/projects/{slug}`
- `GET /api/v2/skills`
- `GET /api/v2/skills/{slug}`
- `GET /api/v2/posts`
- `GET /api/v2/posts/{slug}`
- `GET /api/v2/guestbook`

#### Admin Write APIs

- `POST /api/v2/admin/projects`
- `PATCH /api/v2/admin/projects/{slug}`
- `DELETE /api/v2/admin/projects/{slug}`
- `POST /api/v2/admin/skills`
- `PATCH /api/v2/admin/skills/{slug}`
- `DELETE /api/v2/admin/skills/{slug}`
- `POST /api/v2/admin/posts`
- `PATCH /api/v2/admin/posts/{slug}`
- `DELETE /api/v2/admin/posts/{slug}`
- `POST /api/v2/admin/posts/import/file`
- `POST /api/v2/admin/posts/import/url`
- `PATCH /api/v2/admin/guestbook/{entry_id}`
- `DELETE /api/v2/admin/guestbook/{entry_id}`

#### Ops APIs

- `GET /api/v2/ops/health`
- `GET /api/v2/ops/config`
- `POST /api/v2/ops/reload`

### Query Contract Recommendation

- `page`, `page_size`
- `status`
- `category`
- `tag`
- `sort`
- `q`
- `include`

### Response Contract Recommendation

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

## NEO CLI Architecture

### Entry

- Root command: `./neo`
- Runtime: `server/.venv/bin/python -m tools.neo_cli.main`

### Layers

- `tools/neo_cli/config.py`
  - CLI config persistence
  - `base_url`, `api_prefix`, `token`, `project_root`
- `tools/neo_cli/http_client.py`
  - HTTP transport
  - token injection
  - JSON / file upload support
- `tools/neo_cli/main.py`
  - command parsing
  - resource CRUD
  - system lifecycle integration
  - generic fallback API calls

### Authentication

- `NEO CLI` supports both admin JWT and dedicated CLI personal access tokens.
- Token is stored in `~/.config/neo-cli/config.json`.
- Recommended flow:
  - use admin JWT once
  - create a CLI token
  - switch the CLI to that token for day-to-day operations

### CLI Token APIs

- `GET /api/v1/auth/cli-tokens`
- `POST /api/v1/auth/cli-tokens`
- `POST /api/v1/auth/cli-tokens/revoke`

### V2 Operator APIs

- `GET /api/v2/ops/health`
- `GET /api/v2/admin/projects`
- `GET /api/v2/admin/posts`
- `GET /api/v2/admin/skills`
- `GET /api/v2/admin/guestbook`

### Current CLI Capabilities

#### Auth

- `neo auth login --token <jwt>`
- `neo auth token-list`
- `neo auth token-create --name local-operator --expires-in-days 30`
- `neo auth token-revoke --token-prefix neo_pat_xxx`
- `neo auth logout`
- `neo auth whoami`
- `neo auth github-url`

#### Config

- `neo config show`
- `neo config set base_url http://127.0.0.1:8000`
- `neo config set project_root /path/to/neo`

#### System

- `neo system start`
- `neo system stop`
- `neo system restart`
- `neo system status`
- `neo system health`
- `neo system logs server`
- `neo system logs web`

#### Resource CRUD

- `neo projects list --params '{"page_size": 100}'`
- `neo projects create --data '{"title":"...", "slug":"...", "category":"tool"}'`
- `neo projects create --slug neo-cli --title "NEO CLI" --category tool --tech-stack "python,httpx,cli"`
- `neo projects update my-slug --data '{"featured": true}'`
- `neo projects update my-slug --patch --featured`
- `neo projects delete my-slug`
- `neo skills ...`
- `neo posts ...`
- `neo guestbook ...`

#### Post Import

- `neo posts-import-url <url>`
- `neo posts-import-file ./article.md`

#### Upload

- `neo upload ./cover.png`

#### Generic API

- `neo api request GET /projects --params '{"page_size": 100}'`
- `neo api request PATCH /posts/my-post --data '{"published": true}' --auth`

### Why Generic API Matters

- It guarantees all operations remain reachable even before every endpoint gets a dedicated subcommand.
- It keeps `NEO CLI` future-proof as the API grows.

## Skill Architecture

### Skill Name

- `neo-site-manager`

### Invocation Rule

- Invoke when the user wants to manage this site, run content operations, inspect local services, or perform admin actions through CLI instead of manual UI work.

### Skill Behavior

- Prefer `./neo` commands over manual shell one-offs.
- Use `neo system *` for service lifecycle.
- Use `neo <resource> *` for CRUD.
- Use `neo api request` for unsupported but available endpoints.
- Refuse write actions if the CLI is not authenticated.

## Suggested Rollout

### Phase 1

- Keep current web UI unchanged.
- Use `v1` APIs and the new CLI together.
- Standardize updates with `PATCH`.

### Phase 2

- Add `v2/admin/*` aliases for operator-facing clarity.
- Add pagination metadata to list endpoints.
- Add API key or personal access token support dedicated to CLI.

### Phase 3

- Add audit logs for admin writes.
- Add CLI export/import bundles.
- Add machine-readable OpenAPI docs and auto-generated CLI schemas.

## Local Operation Guide

### Start Everything

```bash
./neo system start
```

### Stop Everything

```bash
./neo system stop
```

### Configure CLI

```bash
./neo config set project_root /Users/bytedance/Desktop/neo
./neo config set base_url http://127.0.0.1:8000
./neo auth login --token <admin-jwt>
```

### Create CLI Token

```bash
./neo auth token-create --name local-operator --expires-in-days 30
./neo auth login --token <neo-pat-token>
```

### Verify Identity

```bash
./neo auth whoami
```

### Create a Project

```bash
./neo projects create \
  --slug neo-cli \
  --title "NEO CLI" \
  --category tool \
  --description "Operator CLI for the NEO website" \
  --tech-stack "python,httpx,cli" \
  --status published \
  --featured
```

### Import a Blog Post

```bash
./neo posts-import-url "https://www.notion.so/your-page"
./neo posts-import-file ./docs/article.md
```

### Patch an Existing Resource

```bash
./neo api request PATCH /projects/neo-cli --data '{"featured": false}' --auth
./neo projects update neo-cli --patch --not-featured
```

## Deployment Notes

- Commit `tools/neo_cli`, `neo`, `infra/scripts/run-local.sh`, `infra/scripts/stop-local.sh`, and `.trae/skills/neo-site-manager`.
- On a new machine:
  - prepare `server/.venv`
  - install backend dependencies
  - install `apps/web` dependencies
  - configure CLI token once
- Use `neo system start` as the default local operator path.

## Next Recommended Enhancements

- Generate typed CLI payload schemas from backend Pydantic models.
- Add `neo status` and `neo logs` short aliases for operator ergonomics.
- Add audit trails for all CLI write actions.
