# NEO + OpenClaw 中文架构说明

## 目标

本方案的目标是把当前网站管理能力统一收口到三层：

1. `NEO API`
2. `NEO CLI`
3. `OpenClaw Skill`

这样无论是：

- 你在本地手动运维
- AI 通过 OpenClaw 自动化操作
- 后续通过 IM 远程下发网站维护任务

都走同一套操作面，而不是分别依赖：

- 后台页面点点点
- 零散 shell 脚本
- 不统一的管理接口

## 总体架构

### 1. API 层

后端当前仍以 `/api/v1` 为兼容主入口，保证现有前端不回归。

同时已经开始补：

- `PATCH` 更新语义
- `/api/v2` 兼容路由骨架
- `/api/v2/admin/*` 管理面命名空间
- `/api/v2/ops/health` 运维探针

### 2. CLI 层

根命令：

```bash
neo
```

作用：

- 启停网站服务
- 查询健康状态
- 调用站点 API
- 管理 `projects / posts / skills / guestbook`
- 处理文件上传与博客导入
- 管理 CLI 专用令牌

### 3. Skill 层

Skill 名称：

- `neo-site-manager`

Skill 作用：

- 让 OpenClaw 在执行网站相关任务时，优先走 `neo`
- 避免 AI 到处拼 shell 命令
- 统一所有自动化修改都经过同一条 CLI 管理路径

### 3.1 Skill 启用前提：必须先完成 CLI 认证

这一点非常关键：

- `neo-site-manager` 不是“装上就能直接改网站”
- 它依赖本地 `neo` 命令已在 PATH 中可见，且 `NEO CLI` 已经有可用 token
- 如果没有 token，OpenClaw 即使选中了 Skill，也会卡在认证检查或请求重试上

推荐的启用前检查命令：

```bash
command -v neo
neo auth whoami
```

如果这条命令失败，说明当前 Skill 还不能真正执行网站管理动作。

### 4. OpenClaw 层

OpenClaw 负责：

- 接收本地或 IM 的任务请求
- 选择合适的 Skill
- 调用 `neo-site-manager`
- 最终让 Skill 通过 `NEO CLI` 操作网站

### 5. IM 层

当前你的本机 OpenClaw 已经接通：

- `Feishu default`

因此 IM 最终链路是：

```text
Feishu IM -> OpenClaw Gateway -> OpenClaw Agent -> neo-site-manager -> neo -> NEO API -> Website
```

## 面向云端 OpenClaw / ECS 的更优雅认证方案

如果 OpenClaw 跑在云端 ECS 上，并且：

- 没有浏览器
- 不和 NEO Site 在同一台机器
- 不和你的本地用户共用同一份 CLI 配置

那么最优雅、方便、也更安全的方案不是手工复制 JWT，而是：

```text
远端 CLI 发起 bootstrap -> 返回授权链接和一次性 code -> 你在任意浏览器打开链接并登录 GitHub -> 批准 -> 远端 CLI 自动拿到 neo_pat
```

我已经把这套链路实现出来了。

### 核心命令

#### 1. 在全新云端宿主机上先安装 neo CLI

```bash
curl -fsSL https://raw.githubusercontent.com/li-neo/neo/main/infra/scripts/install-neo-cli-remote.sh -o /tmp/install-neo-cli-remote.sh && bash /tmp/install-neo-cli-remote.sh
```

作用：

- 适用于一台全新的 ECS / OpenClaw 宿主机
- 先把 `neo` CLI 本体安装到宿主机
- 不再假设宿主机天然已经有 `neo`

#### 2. 给云端 OpenClaw 安装 Skill

```bash
neo openclaw install-skill
```

作用：

- 把 `neo-site-manager` 安装到当前机器的 OpenClaw workspace
- 适合在 ECS 上通过 shell / OpenClaw 自己执行

#### 3. 发起远程安全授权

```bash
neo openclaw bootstrap --client-name openclaw-ecs --token-name openclaw-operator
```

作用：

- 在 OpenClaw 宿主机自动安装/确认 Skill
- 生成一条一次性的浏览器授权链接
- 在宿主机后台自动启动轮询等待
- 你在浏览器里批准后，宿主机自动保存 `neo_pat_...`

CLI 输出示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "session_id": "...",
    "user_code": "QTL1-YGKX",
    "verification_uri": "http://your-site/cli-auth",
    "verification_uri_complete": "http://your-site/cli-auth?session_id=...&user_code=...",
    "poll_interval_seconds": 3,
    "waiter_started": true,
    "waiter_pid": 12345
  }
}
```

### 你如何远程批准

你只需要在任意带浏览器的设备上打开：

```text
verification_uri_complete
```

然后：

1. 用 GitHub 登录 NEO 管理员账号
2. 页面会识别 `session_id + user_code`
3. 点击“批准此 CLI 授权”
4. 云端宿主机后台等待进程自动领取并保存 `neo_pat_...`

### 批准页面

我已经新增了批准页面：

- [cli-auth/page.tsx](file:///Users/bytedance/Desktop/neo/apps/web/src/app/cli-auth/page.tsx)

页面用途：

- 不要求 CLI 在本机带浏览器
- 只要求你能在任意浏览器访问网站
- 适合云端 OpenClaw / ECS / 远程 Agent 的授权场景

### IM 场景下的正确执行模型

这一点必须明确：

- 你在 IM 里发消息时，不是你本地去执行命令
- 真正执行命令的是云端 OpenClaw 所在的 ECS 宿主机

正确链路：

```text
IM -> 云端 OpenClaw -> 在 ECS 本机执行 neo/openclaw 命令
   -> 返回浏览器批准链接给你
   -> 你在浏览器批准
   -> 云端 OpenClaw 继续在 ECS 本机完成 token 领取
```

因此在 IM 场景下，正确行为应该是：

- OpenClaw 自己执行 `neo openclaw bootstrap ...`
- 然后只把批准链接回给你
- 而不是让你手工去远端 shell 执行命令

## 当前落地位置

### Trae Skill

- [neo-site-manager](file:///Users/bytedance/Desktop/neo/.trae/skills/neo-site-manager/SKILL.md)

### OpenClaw Workspace Skill

- [neo-site-manager](file:///Users/bytedance/.openclaw/workspace/skills/neo-site-manager/SKILL.md)

### OpenClaw 本地配置

- [openclaw.json](file:///Users/bytedance/.openclaw/openclaw.json)

我已经把 `neo-site-manager` 单独注册到了 OpenClaw 的 workspace skill 目录，并在配置中显式启用。

### NEO CLI

- [neo](file:///Users/bytedance/Desktop/neo/neo)
- [main.py](file:///Users/bytedance/Desktop/neo/tools/neo_cli/main.py)
- [http_client.py](file:///Users/bytedance/Desktop/neo/tools/neo_cli/http_client.py)
- [config.py](file:///Users/bytedance/Desktop/neo/tools/neo_cli/config.py)

### 中文/说明文档

- [openclaw-neo-site-manager.md](file:///Users/bytedance/Desktop/neo/docs/openclaw-neo-site-manager.md)
- [neo-openclaw-architecture.zh-CN.md](file:///Users/bytedance/Desktop/neo/docs/neo-openclaw-architecture.zh-CN.md)

## 已完成的验证

### 1. Skill 已被 OpenClaw 识别

验证命令：

```bash
openclaw skills list --json
```

验证结果：

- `neo-site-manager`
- `source: openclaw-workspace`
- `eligible: true`
- `disabled: false`

说明：

- 这表示 OpenClaw 已经能发现这个 Skill
- 不是只存在于仓库里，而是已经进入 OpenClaw 的本地技能体系

### 2. Gateway 正常

验证命令：

```bash
openclaw gateway restart
```

结果：

- 网关成功重启

### 3. IM 渠道正常

验证命令：

```bash
openclaw channels status --probe
```

结果：

```text
Feishu default: enabled, configured, running, works
```

说明：

- 这表示 Feishu 渠道已经是“可工作的”
- OpenClaw 到 IM 的接入不是断开的

### 4. Agent 能选中这个 Skill

验证命令：

```bash
openclaw agent --agent main --message "Use the neo-site-manager skill if available and answer with only the selected skill name."
```

结果：

```text
neo-site-manager
```

说明：

- OpenClaw 主代理 `main` 已经能识别并选中 `neo-site-manager`
- 这一步非常关键，因为它说明 Skill 不是“被安装了但不会被调用”

## 当前结论

到目前为止，下面这些链路已经实际验证通过：

1. `neo-site-manager` 已安装到 OpenClaw
2. OpenClaw 网关可用
3. Feishu 渠道可用
4. OpenClaw Agent 可发现并选中 `neo-site-manager`
5. `neo-site-manager` 的设计路径是通过 `neo` 管理这个网站

也就是说：

```text
OpenClaw 本体 -> Skill 发现 -> Agent 选中 Skill -> 调用 NEO CLI
```

这一段是通的。

## 为什么我没有替你直接做 Feishu live send

这次没有做“真实发到 Feishu 某个聊天窗口”的最后一步，不是因为 OpenClaw 不通，而是因为缺少一个安全测试目标。

原因有三点：

1. `openclaw agent` 做投递时，必须显式给出：
   - `--to <target>`
   - 或 `--session-id <id>`
   - 或其他明确会话目标
2. 当前没有提供一个你认可的“测试 DM / 测试群”
3. `openclaw directory self` 当前返回 `Not available`，无法直接拿一个“发给自己”的安全目标做无害测试

所以这次验证停在了：

- `渠道在线`
- `Skill 已注册`
- `Agent 能选中 Skill`

但没有替你真的向 Feishu 某个目标发一条自动化任务消息。

## 你后续自己做 Feishu 远程验证的方法

### 前提

准备一个安全测试目标：

- 一个专门的 Feishu 测试群
- 或一个你自己的测试 DM

### 建议第一条测试命令

```bash
openclaw agent \
  --agent main \
  --to <你的-feishu-测试目标> \
  --message "Use neo-site-manager to check the NEO website status and report the result without changing anything." \
  --deliver
```

预期结果：

1. Feishu 消息进入 OpenClaw
2. OpenClaw 路由到 `main` agent
3. `main` 选中 `neo-site-manager`
4. Skill 调用 `neo` 做只读检查
5. 结果回发到 Feishu

### 建议第二条测试命令

```bash
openclaw agent \
  --agent main \
  --to <你的-feishu-测试目标> \
  --message "Use neo-site-manager to create a draft blog post named openclaw-smoke-test, summarize what changed, and do not publish it." \
  --deliver
```

预期结果：

1. OpenClaw 通过 Skill 调用 `NEO CLI`
2. 新建一个草稿文章
3. 返回变更摘要到 Feishu

### 建议先做只读，再做写入

推荐顺序：

1. 先做 `status / list / health` 类只读验证
2. 再做创建草稿
3. 最后才做更新、删除、发布类操作

## 推荐的实际使用方式

### 本地手动

```bash
neo system start
neo auth whoami
neo projects list --params '{"page_size":10}'
```

### OpenClaw 自动化

通过 `neo-site-manager`，OpenClaw 应优先执行：

- `neo system *`
- `neo projects *`
- `neo posts *`
- `neo skills *`
- `neo guestbook *`
- `neo api request *`

而不是直接拼装一堆零散 shell。

### 认证建议

不建议长期让 OpenClaw 持有管理员 JWT。

建议流程：

1. 先用管理员 JWT 初始化一次
2. 再创建 CLI 专用 PAT
3. 之后让 OpenClaw 持有 PAT，而不是 JWT

示例：

```bash
neo auth login --token <admin-jwt>
neo auth token-create --name openclaw-operator --expires-in-days 30
neo auth login --token <neo-pat-token>
```

### 完整认证流程（中文）

#### 先说结论：CLI 不直接走 GitHub OAuth 页面登录

当前源码里的真实逻辑是：

1. Web 管理后台使用 GitHub OAuth 登录
2. 后端在 GitHub 回调成功后，签发 NEO 自己的管理员 JWT
3. 前端把这个 JWT 保存到浏览器本地
4. CLI 再使用这个 JWT 登录，或者进一步生成 CLI Token

也就是说：

- GitHub 账号本身不是 CLI 直接使用的 token
- CLI 真正使用的是：
  - 管理员 JWT
  - 或者 `neo_pat_...` 形式的 CLI Token

#### 源码证据

##### 1. GitHub 登录地址由后端生成

后端接口：

- [auth.py](file:///Users/bytedance/Desktop/neo/server/app/api/v1/auth.py#L19-L29)

这里会返回 GitHub OAuth URL：

```python
@router.get("/github/login")
def github_login():
    ...
```

##### 2. GitHub 回调成功后，后端签发 JWT

后端接口：

- [auth.py](file:///Users/bytedance/Desktop/neo/server/app/api/v1/auth.py#L31-L113)

关键逻辑：

- 用 GitHub `code` 去换 GitHub access token
- 再去 GitHub 拉用户信息
- 判断当前 GitHub 用户是不是管理员
- 最后调用 `create_access_token()` 生成 NEO 自己的 JWT

对应代码：

- [auth.py](file:///Users/bytedance/Desktop/neo/server/app/api/v1/auth.py#L106-L113)
- [security.py](file:///Users/bytedance/Desktop/neo/server/app/core/security.py#L17-L23)

##### 3. 前端把管理员 JWT 存进 localStorage

前端后台页面：

- [page.tsx](file:///Users/bytedance/Desktop/neo/apps/web/src/app/admin/page.tsx#L13-L24)
- [page.tsx](file:///Users/bytedance/Desktop/neo/apps/web/src/app/admin/page.tsx#L111-L138)

关键点：

- Token key 是 `neo-admin-token`
- GitHub callback 成功后，前端执行：

```ts
setToken(d.data.access_token);
```

- `setToken()` 最终会把 token 存到：

```ts
localStorage.setItem("neo-admin-token", t)
```

#### 所以，你怎么获取 `<你的-jwt-token>`

最直接的方式就是：

##### 方法 A：从 Web 管理后台登录后获取

操作步骤：

1. 打开网站后台 `/admin`
2. 点击 GitHub 登录
3. 登录成功后，前端会把管理员 JWT 存到浏览器 `localStorage`
4. 打开浏览器开发者工具，执行：

```js
localStorage.getItem("neo-admin-token")
```

你拿到的这一串字符串，就是：

```text
<你的-jwt-token>
```

然后 CLI 登录：

```bash
neo auth login --token <你的-jwt-token>
neo auth whoami
```

##### 方法 B：如果你已经在这个浏览器里登录过后台

直接在浏览器控制台执行：

```js
localStorage.getItem("neo-admin-token")
```

复制结果即可。

#### 然后，你怎么获取 `<neo-pat-token>`

这个不是从浏览器直接拿，而是通过 CLI 或 API 创建。

源码证据：

- [auth.py](file:///Users/bytedance/Desktop/neo/server/app/api/v1/auth.py#L152-L181)
- [security.py](file:///Users/bytedance/Desktop/neo/server/app/core/security.py#L40-L45)

后端会：

1. 生成一个 `neo_pat_` 开头的原始 token
2. 只返回一次明文 token
3. 数据库存的其实是 hash，不是明文

也就是说：

- `neo_pat_...` 只能在创建时看到一次
- 之后只能看到 `token_prefix`
- 看不到完整明文

获取步骤：

```bash
# 先用管理员 JWT 登录
neo auth login --token <你的-admin-jwt>

# 创建 CLI Token
neo auth token-create --name openclaw-operator --expires-in-days 30
```

返回结果里会有：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "neo_pat_xxxx",
    "token_prefix": "neo_pat_xxxx...",
    "name": "openclaw-operator"
  }
}
```

其中：

- `data.token` 就是你真正要保存的 `<neo-pat-token>`

然后再登录：

```bash
neo auth login --token <neo-pat-token>
neo auth whoami
```

#### 方法 1：使用 Admin JWT 登录（推荐）

如果你已经有网站的 admin JWT token，可以直接登录：

```bash
neo auth login --token <你的-jwt-token>
neo auth whoami
```

#### 方法 2：创建 CLI Token（更安全）

先用 admin JWT 登录，再创建专用 CLI token，然后改用 CLI token 登录：

```bash
# 1. 用 admin JWT 登录
neo auth login --token <你的-admin-jwt>

# 2. 创建一个 30 天有效的 CLI token
neo auth token-create --name openclaw-operator --expires-in-days 30

# 3. 返回一个 token，格式类似 neo_pat_xxxx
# 然后用这个 token 登录
neo auth login --token <neo-pat-token>

# 4. 验证认证状态
neo auth whoami
```

#### Token 的来源

- Admin JWT token 来自 Web 后台 GitHub 登录成功后，后端签发并存进浏览器 `localStorage`
- 浏览器中对应的 key 是：`neo-admin-token`
- CLI Token 则来自已登录状态下执行的 `neo auth token-create`

#### Agent 管理员授权怎么理解

这里最容易混淆，我直接说清楚：

- OpenClaw Agent 并没有一套独立于 `neo` 的“网站管理员权限系统”
- 它本质上是调用本机的 `neo` 命令
- 所以真正需要授权的是：
  - `neo` 这套 CLI
  - 而不是单独再给 Agent 配一套网站权限

也就是说：

```text
给 CLI 登录 = 给 OpenClaw Agent 间接授权
```

前提是：

- OpenClaw 和 `neo` 运行在同一个 macOS 用户下
- 它们读取的是同一份 CLI 配置

#### 给 Agent 授权的推荐方式

##### 推荐方式

1. 你先在当前用户下完成 `neo` 登录
2. 然后 OpenClaw 在同一用户下运行
3. OpenClaw 自动复用这份 token

推荐命令：

```bash
neo auth login --token <你的-admin-jwt>
neo auth token-create --name openclaw-operator --expires-in-days 30
neo auth login --token <neo-pat-token>
neo auth whoami
```

然后再测试 OpenClaw：

```bash
openclaw agent --agent main --message "Use neo-site-manager to check auth and report readiness."
```

##### 为什么推荐 PAT 而不是长期 JWT

- JWT 更偏向 Web 会话
- PAT 更适合 CLI / Agent 长期自动化
- 你后续可以单独 revoke PAT，而不影响网页登录状态

#### Skill 的正确行为

- 如果 `neo auth whoami` 失败，Skill 不应继续执行任何网站管理动作
- 正确行为应该是先告诉用户如何完成认证
- 认证完成后，再继续 `guestbook / posts / projects / skills / system` 等操作

### 让 `neo` 成为全局可见 CLI

不建议长期依赖工作目录中的 `./neo`。

建议先安装全局命令：

```bash
bash infra/scripts/install-neo-cli.sh
command -v neo
neo --help
```

安装脚本会优先选择当前 PATH 中可写的标准 bin 目录，例如：

- `/opt/homebrew/bin`
- `/usr/local/bin`
- `~/.local/bin`
- `~/.npm-global/bin`

这样 Skill 和 OpenClaw 都只需要调用 `neo`，不需要写绝对路径或 `./neo`。

### 云端 OpenClaw 推荐完整流程

假设你的 OpenClaw 跑在一台 ECS 上：

#### 第一步：在 ECS 上安装 Skill

```bash
neo openclaw install-skill
```

#### 第二步：在 ECS 上发起授权

```bash
neo auth bootstrap --client-name openclaw-ecs --token-name openclaw-operator
```

#### 第三步：在你的浏览器里打开授权链接并批准

- 打开 CLI 输出里的 `verification_uri_complete`
- 用 GitHub 登录管理员账号
- 点击批准

#### 第四步：ECS 自动完成授权

CLI 会自动保存 token，然后你可以验证：

```bash
neo auth whoami
```

#### 第五步：让 OpenClaw 通过 IM 使用这个 Skill

之后你就可以通过 IM 对云端 OpenClaw 说：

- 安装 `neo-site-manager`
- 检查网站健康状态
- 查看留言板
- 导入文章
- 发布草稿

OpenClaw 会通过已经授权的 `neo` 来操作网站。

## 当前方案的优点

### 1. 管理面统一

网站管理统一走：

```text
OpenClaw / 人工 -> NEO CLI -> API -> Website
```

### 2. Skill 可替换、CLI 可复用

- 以后你换 IM 渠道，不需要重写网站操作逻辑
- 以后你换 Agent，也不需要重写 CLI 层

### 3. Web 与自动化不耦死

- 前台页面继续可用
- 后台页面继续可用
- CLI 和 Skill 是独立的自动化操作面

### 4. 适合后续远程迭代

你未来可以在 Feishu 里直接发：

- “帮我新建一个草稿文章”
- “把这个项目设为 featured”
- “检查网站是否健康”
- “导入这篇 Notion 文档”

然后让 OpenClaw 自动调用 `neo-site-manager` 去执行。

## 当前还建议继续补强的点

### 1. PAT 权限分级

建议后续加：

- 只读 PAT
- 内容写入 PAT
- 运维 PAT

### 2. 审计日志

建议记录：

- 哪个 PAT
- 何时
- 通过哪个 Skill
- 改了哪个资源

### 3. IM 测试目标白名单

建议给 Feishu 测试目标加白名单，避免误发到正式群。

### 4. v2 admin 独立控制器

现在 `v2 admin` 还是兼容别名层，后续可以做真正独立的控制器与返回结构。

## 一句话总结

现在这套链路已经做到：

- `neo-site-manager` 已被 OpenClaw 正式安装并单独列出
- OpenClaw 能识别并调用它
- Feishu IM 渠道在线可工作
- 远程 AI 自动化迭代这个网站的基础链路已经打通

当前只差最后一步：

- 你提供或选择一个安全的 Feishu 测试目标
- 然后按上面的 `openclaw agent --to ... --deliver` 做真实投递验证
