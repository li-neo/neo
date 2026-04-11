[OPEN] ecs-domain-access

## 背景
- 现象: ECS 本机 `curl http://127.0.0.1` 返回 200，但外部访问 `http://101.96.207.11`、`http://li-neo.top`、`http://www.li-neo.top` 卡住。
- 已知:
  - `nginx`、`neo-web`、`neo-server` 均为 running
  - `ss -lntp` 显示 `0.0.0.0:80`、`0.0.0.0:3000`、`0.0.0.0:8000` 正在监听
  - DNS 已将 `www.li-neo.top` 解析到 `101.96.207.11`
  - `firewalld` 已放行 `http/https` 和 `80/443`

## 初始假设
1. ECS 实例当前实际公网 IP 与 DNS 指向的 `101.96.207.11` 不一致。
2. 火山控制台中放行的是其他安全组，当前实例实际绑定的安全组未放通入站流量。
3. 运营商或边界网络对公网入口做了额外拦截，导致本机回环正常但外部 TCP 无法建立。
4. Nginx 正常监听本机，但宿主机公网路由/NAT 未正确工作，外部无法到达 `eth0:80`。

## 下一步证据
- 在 ECS 上确认真实公网出口 IP。
- 在 ECS 上抓取 `eth0:80` 入站包，验证外部请求是否到达网卡。
- 从外部再次发起请求，结合抓包判断问题层级。

## 已获取证据
- `tcpdump -ni eth0 port 80` 显示外部客户端与 `172.31.32.3:80` 已完成 TCP 三次握手，说明公网流量已到达实例，EIP 绑定、安全组和本机 80 端口监听基本正常。
- `nginx -T` 显示：
  - `/etc/nginx/nginx.conf` 内置了一个 `listen 80; server_name _;` 的默认 server。
  - `/etc/nginx/conf.d/neo.conf` 又配置了 `server_name li-neo.top www.li-neo.top _;`
  - Nginx 明确警告 `conflicting server name "_" on 0.0.0.0:80, ignored`

## 当前判断
- 假设 1: 公网 IP 与 DNS 不一致。当前证据不足以支持，暂未确认。
- 假设 2: 安全组未放通。已基本证伪。
- 假设 3: 外部请求未到达实例。已证伪。
- 假设 4: Nginx 默认虚拟主机冲突或请求命中了错误 server。当前最可疑。

## 新证据
- 从外部执行 `curl -v --connect-timeout 5 http://li-neo.top` 返回：
  - TCP 已连接到 `101.96.207.11:80`
  - HTTP 响应头为 `Server: Suzaku`
  - 返回 `Location: https://webblock.volcengine.com`

## 结论更新
- 外部请求并没有落到用户自建的 Nginx，而是在火山云侧被 `webblock` 拦截。
- 当前问题从“实例/安全组/Nginx 配置”转移为“火山云侧域名访问管控或备案拦截”。
