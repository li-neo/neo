---
name: "neo-site-manager"
description: "Manages the NEO website through the local NEO CLI. Invoke when the user wants site CRUD, local service control, content import, config updates, or admin operations."
---

# NEO Site Manager

Use this skill when the user wants to manage the NEO website through the local `NEO CLI` instead of manually editing data in the browser.

## Use This Skill When

- The user wants to create, edit, publish, archive, or delete website content.
- The user wants to import blog content from Markdown, PDF, Feishu, or Notion.
- The user wants to start, stop, restart, or inspect local site services.
- The user wants to inspect or call backend APIs through a consistent operator interface.
- The user wants config or admin operations to be executed through `neo`.

## Core Rule

- Prefer `neo` commands over ad hoc shell commands whenever the operation is supported by the CLI.
- Use direct shell commands only when `NEO CLI` does not yet expose the required operation.

## Mandatory Execution Contract / 强制执行约束

- The user is talking to OpenClaw through IM, not directly to the ECS shell.
- 用户是在通过 IM 和 OpenClaw 交互，不是在直接操作 ECS shell。
- If the OpenClaw host can execute a command itself, do not ask the user to execute that command manually.
- 如果 OpenClaw 宿主机自己能执行某条命令，就不要再让用户手工执行。
- In remote/cloud scenarios, install/bootstrap/auth commands must run on the host automatically.
- 在远端 / 云端场景下，安装 / bootstrap / auth 命令必须由宿主机自动执行。
- Only return:
- 最终只允许返回：
  - approval link / 批准链接
  - short approval instruction / 简短批准说明
  - final operation result / 最终执行结果

### Forbidden Behavior / 禁止行为

- Do not say: `请在远程机器上运行 neo ...`
- 不要说：`请在远程机器上运行 neo ...`
- Do not say: `你先执行这个命令，再告诉我结果`
- 不要说：`你先执行这个命令，再告诉我结果`
- Do not ask for JWT first when bootstrap auth is available.
- 当 bootstrap 可用时，不要先问用户要 JWT。

### Required Behavior / 必需行为

- If `neo` is missing, install `neo` on the host automatically, then continue.
- 如果 `neo` 缺失，应先在宿主机自动安装 `neo`，然后继续。
- If auth is missing, execute `neo openclaw bootstrap ...` on the host, then return only `verification_uri_complete`.
- 如果缺少认证，应先在宿主机执行 `neo openclaw bootstrap ...`，然后只返回 `verification_uri_complete`。
- After approval, continue on the host automatically and then perform the original website task.
- 批准完成后，应在宿主机自动继续，并继续执行原始网站任务。

## First Action / 首要动作

For remote/cloud IM requests, always follow this exact order on the OpenClaw host:
对远端 / 云端 IM 请求，始终在 OpenClaw 宿主机按这个顺序执行：

1. `command -v neo`
2. if missing, install `neo` on the host automatically
3. `neo auth status`
4. if unauthenticated, run `neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator`
5. read `verification_uri_complete`
6. reply only with the approval link and one short instruction
7. after approval, continue the original website task automatically

- This is the default path.
- 这是默认路径。
- Do not fall back to asking for JWT first unless bootstrap auth is unavailable.
- 除非 bootstrap 不可用，否则不要先问 JWT。

## Authentication Required / 启用前必须认证

- This skill must verify `NEO CLI` authentication before any site management action.
- 这个 Skill 在执行任何网站管理动作前，必须先确认 `NEO CLI` 已完成认证。
- If no token is configured, the skill should stop and guide the user to authenticate first.
- 如果本地没有 token，Skill 不应继续执行，而应先引导用户完成认证。

### Preflight Check / 启用前检查

```bash
command -v neo
neo auth status
neo auth whoami
```

- If `neo` is missing on a fresh remote host, the host should install it first:
- 如果一台全新的远端宿主机上还没有 `neo`，应先由宿主机自己安装：

```bash
curl -fsSL https://raw.githubusercontent.com/li-neo/neo/main/infra/scripts/install-neo-cli-remote.sh -o /tmp/install-neo-cli-remote.sh && bash /tmp/install-neo-cli-remote.sh
```

- Do not ask the user to run the install command on their own machine.
- 不要让用户在自己的机器上执行这条安装命令。

- If `neo auth status` or `neo auth whoami` succeeds, the skill can continue.
- 如果 `neo auth status` 或 `neo auth whoami` 成功，说明 Skill 可以继续使用。
- If this fails, complete one of the login flows below first.
- 如果失败，先完成下面任意一种认证流程。

### Method 1: Bootstrap Auth (Recommended For Remote / Cloud) / 方法 1：Bootstrap 授权（远端 / 云端优先推荐）

```bash
neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator
```

- Use this first when OpenClaw or the CLI runs on a different machine, on ECS, or in any headless environment.
- 如果 OpenClaw 或 CLI 跑在另一台机器、ECS 或无浏览器环境，优先使用这个方案。
- The command must run on the OpenClaw host, not on the user's own machine.
- 这条命令必须由 OpenClaw 宿主机执行，而不是让用户自己在本地执行。
- If `neo` is not installed yet, the host should install `neo` first, then run bootstrap.
- 如果宿主机还没有安装 `neo`，应先安装 `neo`，再执行 bootstrap。
- This flow prints a verification URL and a one-time user code, then starts a background waiter on the host.
- 这条命令会打印授权链接、一次性 user code，并在宿主机后台启动等待进程。
- The assistant should return the approval link to the user in IM and stop asking for JWT first.
- Assistant 应把批准链接回给用户，不要先追问 JWT。
- After browser approval, the host automatically polls and stores a `neo_pat_...` token.
- 浏览器批准后，宿主机会自动轮询并保存 `neo_pat_...` token。

### IM Reply Template / IM 回复模板

```text
请打开这个授权链接完成批准：
<verification_uri_complete>

批准后我会继续在宿主机上自动完成授权并继续处理你的网站任务。
```

- Do not include the raw bootstrap command in the IM reply unless the user explicitly asks for the command itself.
- 除非用户明确要求查看命令本身，否则不要在 IM 回复里展示原始 bootstrap 命令。

### Method 2: Admin JWT Login (Fallback) / 方法 2：使用 Admin JWT 登录（兜底方式）

```bash
neo auth login --token <你的-jwt-token>
neo auth whoami
```

- Use this only when bootstrap auth is unavailable or the user explicitly wants a manual login flow.
- 仅在 bootstrap 授权不可用，或用户明确要求手工登录时使用。

### Method 3: CLI Token From Admin JWT / 方法 3：基于 Admin JWT 创建 CLI Token

```bash
# 1. 用 admin JWT 登录
neo auth login --token <你的-admin-jwt>

# 2. 创建一个 30 天有效的 CLI token
neo auth token-create --name openclaw-operator --expires-in-days 30

# 3. 用返回的 neo_pat_xxxx 再次登录
neo auth login --token <neo-pat-token>

# 4. 验证认证状态
neo auth whoami
```

- Use this after manual JWT login if bootstrap auth is not being used.
- 当不使用 bootstrap 授权时，可在手工 JWT 登录后转成更安全的 CLI Token。

### Token Source / Token 来源

- Admin JWT usually comes from the website admin login flow.
- Admin JWT 通常来自网站管理员登录后的令牌。
- CLI Token is created from an existing admin-authenticated session.
- CLI Token 则是在已完成管理员认证后，通过 `token-create` 生成。
- For remote/cloud OpenClaw, prefer `neo auth bootstrap` instead of asking the user for a JWT first.
- 对远端 / 云端 OpenClaw，优先使用 `neo auth bootstrap`，不要一上来先问用户要 JWT。

### Skill Behavior When Unauthenticated / 未认证时的 Skill 行为

- Do not proceed with `projects/posts/skills/guestbook/system` operations if `neo auth status` or `neo auth whoami` fails.
- 如果 `neo auth status` 或 `neo auth whoami` 失败，不要继续执行 `projects/posts/skills/guestbook/system` 相关操作。
- For remote/cloud scenarios, execute `neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator` on the host first.
- 对远端 / 云端场景，应优先在宿主机执行 `neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator`。
- If `neo` is missing entirely, execute the remote installer command on the host first.
- 如果宿主机完全没有 `neo`，应先在宿主机执行远端安装命令。
- Then return only the approval link and concise browser instructions to the user.
- 然后只把批准链接和简短浏览器说明返回给用户。
- Do not first ask whether the user already has a JWT unless bootstrap auth is unavailable.
- 不要先追问用户是否已有 JWT，除非 bootstrap 授权不可用。

### Previously Supported Short Form / 兼容简写

```bash
neo auth status
neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator
neo auth whoami
```

## Common Commands

### System

```bash
neo system start
neo system stop
neo system restart
neo system health
neo system status
neo system logs server
neo system logs web
```

### Config

```bash
neo config show
neo config set base_url http://127.0.0.1:8000
neo config set api_prefix /api/v2
```

### Projects

```bash
neo projects list --params '{"page_size": 100}' --auth
neo projects create --slug demo --title "Demo" --category tool --description "demo"
neo projects update demo --patch --featured
neo projects delete demo
```

### Skills

```bash
neo skills list --auth
neo skills create --slug demo-skill --name "Demo Skill" --category development --description "demo" --status published
neo skills update demo-skill --patch --version 0.2.0
neo skills delete demo-skill
```

### Posts

```bash
neo posts list --params '{"page_size": 100}' --auth
neo posts create --slug demo-post --title "Demo Post" --summary "demo" --content "# Demo" --published
neo posts update demo-post --patch --draft
neo posts delete demo-post
neo posts import-url "https://example.com/article"
neo posts import-file ./docs/article.md
```

### Guestbook

```bash
neo guestbook list --params '{"page_size": 100}'
neo guestbook update 1 --data '{"message":"Updated via CLI"}'
neo guestbook delete 1
```

### Generic API

Use this when there is no dedicated command yet:

```bash
neo api request GET /projects --params '{"page_size": 50}'
neo api request PATCH /posts/demo-post --data '{"published":true}' --auth
neo api request GET /api/v2/admin/projects --auth
```

## Operator Workflow

1. Check config and auth.
2. Use `neo system *` if the task touches runtime lifecycle.
3. Use specific resource commands for CRUD.
4. Use `neo api request` only when a dedicated subcommand is missing.
5. Return command results in a concise, operator-friendly summary.

## Notes

- The CLI is compatibility-first and defaults to `/api/v1`, but can be switched to `/api/v2`.
- Update operations support `PUT` and `PATCH` on the backend.
- The preferred local operator flow is `neo system start` rather than raw `pnpm dev`.
