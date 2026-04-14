[OPEN] detail-pages-client-error

# Debug Session: detail-pages-client-error

## Symptom

- `skills` 和 `blog` 详情页打开时报错：`Application error: a client-side exception has occurred while loading localhost`
- 用户反馈 `projects` 详情页未明确报错，因此问题可能集中在部分详情页的共享渲染链路或数据形态差异

## Scope

- Frontend runtime
- Detail pages
- Shared markdown/document rendering

## Hypotheses

1. `MarkdownRenderer` 新增的 `rehypeRaw` / 自定义组件在 `blog` 或 `skill` 的实际内容上触发了客户端异常。
2. `EntityDocLayout` 注入的某个 props（例如 `badges` / `highlights` / `tocItems`）在 `blog` 或 `skill` 的数据形态下包含非法值，导致渲染时崩溃。
3. `blog` / `skill` 详情页新增的管理员编辑相关逻辑在浏览器端访问了未准备好的对象或状态，触发运行时异常。
4. `blog` 与 `skill` 页面引用的某个依赖已通过类型检查，但在浏览器运行时因为 SSR/CSR 边界或数据值问题出错。
5. 错误只发生在某些具体内容数据上，例如 Markdown 中的表格、HTML 标签、`icon` 标签或 blockquote callout 格式触发异常。

## Plan

1. 给 `blog/[slug]`、`skills/[slug]`、共享渲染器加最小运行时埋点。
2. 本地复现并收集浏览器/前端运行时证据。
3. 根据日志确认是哪一层崩溃：页面数据、共享布局、还是 Markdown 渲染器。
4. 只在证据明确后做最小修复。
