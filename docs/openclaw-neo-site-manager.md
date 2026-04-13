# OpenClaw + NEO Site Manager

## Installed Locations

- Trae skill:
  - `/Users/bytedance/Desktop/neo/.trae/skills/neo-site-manager/SKILL.md`
- OpenClaw workspace skill:
  - `/Users/bytedance/.openclaw/workspace/skills/neo-site-manager/SKILL.md`
- OpenClaw config entry:
  - `/Users/bytedance/.openclaw/openclaw.json`

## Remote / Cloud-Friendly Workflow

For cloud OpenClaw or ECS hosts without a browser, use this flow:

### 1. Install the neo CLI on the remote host first

```bash
curl -fsSL https://raw.githubusercontent.com/li-neo/neo/main/infra/scripts/install-neo-cli-remote.sh -o /tmp/install-neo-cli-remote.sh && bash /tmp/install-neo-cli-remote.sh
```

This step is required on a fresh ECS/OpenClaw host that does not have `neo` yet.

### 2. Install the Skill on the remote machine

```bash
neo openclaw install-skill
```

### 3. Start bootstrap auth on the remote machine

```bash
neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator
```

This returns:

- `verification_uri`
- `verification_uri_complete`
- `user_code`
- background waiter details on the host

### 4. Approve from any browser

Open `verification_uri_complete` in a browser, log in with GitHub as an admin, and approve the request.

### 5. Remote CLI receives PAT automatically

The remote host starts a background waiter immediately. After approval, the host-side `neo` CLI receives a `neo_pat_...` token and saves it into its own config automatically.

## What Was Verified

### 1. Skill Registration

- `neo-site-manager` is listed by:

```bash
openclaw skills list --json
```

- Current status:
  - `source: openclaw-workspace`
  - `eligible: true`
  - `disabled: false`

### 2. Gateway and IM Channel

- Gateway restart succeeded:

```bash
openclaw gateway restart
```

- Channel probe succeeded:

```bash
openclaw channels status --probe
```

- Verified result:
  - `Feishu default: enabled, configured, running, works`

### 3. Agent Can See the Skill

- Verified with:

```bash
openclaw agent --agent main --message "Use the neo-site-manager skill if available and answer with only the selected skill name."
```

- Result:

```text
neo-site-manager
```

This proves the OpenClaw agent can discover and select the installed skill.

## What This Means

The end-to-end automation chain is validated up to these layers:

1. OpenClaw Gateway is running
2. Feishu IM channel is healthy
3. `neo-site-manager` is installed and eligible
4. OpenClaw agent can select the skill
5. The skill can operate the site through `neo`

## Authentication Prerequisite / 认证前置条件

- `neo-site-manager` requires a valid `NEO CLI` token before it can safely manage the site.
- `neo-site-manager` 在真正管理网站前，必须先确保本地 `NEO CLI` 已经有可用 token。
- Recommended preflight command:

```bash
command -v neo
neo auth whoami
```

- If this fails, the skill should stop and ask for authentication first.
- 如果这条命令失败，Skill 应立即停止，并先引导用户完成认证。

### Method 1: Admin JWT Login / 方法 1：使用 Admin JWT 登录

How to get `<your-jwt-token>`:

- Log in to the web admin page through GitHub.
- Open the browser devtools console.
- Run:

```js
localStorage.getItem("neo-admin-token")
```

- The returned value is the admin JWT used by `neo`.

```bash
neo auth login --token <你的-jwt-token>
neo auth whoami
```

### Method 2: CLI Token / 方法 2：创建 CLI Token

How to get `<neo-pat-token>`:

- First authenticate `neo` with an admin JWT.
- Then run `neo auth token-create`.
- The returned `data.token` field is the real `neo_pat_...` token.
- It is only shown at creation time.

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

### Expected Skill Behavior / Skill 的预期行为

- If `neo auth whoami` fails, the skill should not continue with guestbook or other site operations.
- 如果 `neo auth whoami` 失败，Skill 不应继续执行留言板或其他网站操作。
- It should return the exact login steps instead of retrying blindly.
- 正确行为应该是返回明确的登录步骤，而不是盲目重试。

### Agent Authorization / Agent 授权说明

- OpenClaw agent does not need a separate website-admin permission model.
- OpenClaw agent 本身不需要另一套独立的网站管理员权限模型。
- It reuses the local `neo` CLI token of the same OS user.
- 它复用的是同一操作系统用户下的 `neo` CLI token。
- In practice:
- 实际上等价于：

```text
Authorize neo CLI = authorize OpenClaw agent
```

## Current Limitation

The final outbound IM delivery step was **not** executed against a real chat target in this round, because:

- `openclaw agent` requires one of:
  - `--to <target>`
  - `--session-id <id>`
  - `--agent <id>`
- A safe explicit Feishu DM/group target was not provided for a live send test.
- `openclaw directory self` returned `Not available`, so there was no built-in self-recipient to use for a harmless echo test.

## Recommended Real IM Test

Use a dedicated Feishu test DM or test group, then run:

```bash
openclaw agent \
  --agent main \
  --to <feishu-target> \
  --message "Use neo-site-manager to inspect the NEO website status and report the result." \
  --deliver
```

Expected behavior:

1. Feishu message reaches OpenClaw
2. OpenClaw routes it to `main`
3. Agent selects `neo-site-manager`
4. Skill calls `neo system status` or related commands
5. The result is delivered back to Feishu

## Suggested Safe First Prompt

```text
Use neo-site-manager to:
1. check the NEO site health
2. list the first 3 projects
3. report the result without changing anything
```

## Suggested Second Prompt

```text
Use neo-site-manager to:
1. create a draft blog post called "openclaw-smoke-test"
2. summarize what changed
3. do not publish it
```

## Operational Notes

- Use PAT rather than long-lived admin JWT for OpenClaw.
- Keep destructive operations explicit.
- Prefer read-only validation prompts before any mutation prompt.
- For production remote automation, use a dedicated test chat/group and keep logs enabled.

## Global CLI Install / 全局 CLI 安装

To make the skill portable, install `neo` as a PATH-visible command first:

```bash
bash infra/scripts/install-neo-cli.sh
command -v neo
neo --help
```

This avoids hardcoded absolute paths and avoids relying on `./neo`.
