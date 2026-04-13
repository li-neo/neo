"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

const TOKEN_KEY = "neo-admin-token";

type BootstrapStatus = {
  session_id: string;
  user_code: string;
  status: string;
  client_name: string | null;
  token_name: string;
  approved_at: string | null;
  claimed_at: string | null;
  expires_at: string;
};

function getStoredToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

export default function CliAuthPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState<string>("");

  const params = useMemo(() => {
    if (typeof window === "undefined") return { sessionId: "", userCode: "" };
    const search = new URLSearchParams(window.location.search);
    return {
      sessionId: search.get("session_id") || "",
      userCode: search.get("user_code") || "",
    };
  }, []);

  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    const pageUrl = `${window.location.origin}/cli-auth?session_id=${encodeURIComponent(params.sessionId)}&user_code=${encodeURIComponent(params.userCode)}`;
    const cbUrl = new URL(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/github/callback`);
    cbUrl.searchParams.set("code", code);
    cbUrl.searchParams.set("redirect_uri", pageUrl);
    window.history.replaceState({}, "", `/cli-auth?session_id=${encodeURIComponent(params.sessionId)}&user_code=${encodeURIComponent(params.userCode)}`);
    fetch(cbUrl.toString())
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.access_token) {
          localStorage.setItem(TOKEN_KEY, d.data.access_token);
          setToken(d.data.access_token);
          setMessage("GitHub 登录成功，现在可以批准 CLI 授权。");
        } else {
          setMessage("GitHub 登录失败，请重试。");
        }
      })
      .catch(() => setMessage("GitHub 登录失败，请重试。"));
  }, [params.sessionId, params.userCode]);

  useEffect(() => {
    if (!params.sessionId || !params.userCode) {
      setLoading(false);
      setMessage("缺少 session_id 或 user_code，无法继续。");
      return;
    }
    api.auth.cliBootstrapStatus(params.sessionId, params.userCode).then((res) => {
      if (res.data) {
        setStatus(res.data);
      } else {
        setMessage(res.message || "无法读取 CLI 授权会话。");
      }
      setLoading(false);
    });
  }, [params.sessionId, params.userCode]);

  const handleLogin = async () => {
    const res = await api.auth.githubLoginUrl();
    if (!res.data?.url) {
      setMessage("无法获取 GitHub 登录地址。");
      return;
    }
    const pageUrl = `${window.location.origin}/cli-auth?session_id=${encodeURIComponent(params.sessionId)}&user_code=${encodeURIComponent(params.userCode)}`;
    const url = new URL(res.data.url);
    url.searchParams.set("redirect_uri", pageUrl);
    window.location.href = url.toString();
  };

  const handleApprove = async () => {
    if (!token) {
      setMessage("请先用 GitHub 登录管理员账号。");
      return;
    }
    setApproving(true);
    const res = await api.auth.cliBootstrapApprove(token, params.sessionId, params.userCode);
    setApproving(false);
    if (res.data) {
      const approved = res.data;
      setStatus((prev) => prev ? { ...prev, status: approved.status, approved_at: approved.approved_at } : prev);
      setMessage("授权成功。远端 CLI 现在可以领取 neo_pat token。");
      return;
    }
    setMessage(res.message || "授权失败，请确认当前账号具备管理员权限。");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-3 text-2xl font-semibold">CLI 远程授权 / CLI Bootstrap Auth</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          用于给远端 OpenClaw / CLI 安全签发一个可撤销的 `neo_pat` token。只有管理员登录后才能批准。
        </p>

        {loading && <p className="text-sm text-muted-foreground">正在读取授权会话...</p>}

        {!loading && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-muted/30 p-4">
              <p><strong>Session:</strong> {params.sessionId || "-"}</p>
              <p><strong>User Code:</strong> {params.userCode || "-"}</p>
              <p><strong>Client:</strong> {status?.client_name || "unknown"}</p>
              <p><strong>Token Name:</strong> {status?.token_name || "openclaw-operator"}</p>
              <p><strong>Status:</strong> {status?.status || "unknown"}</p>
              <p><strong>Expires At:</strong> {status?.expires_at || "-"}</p>
            </div>

            {message && (
              <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                {message}
              </div>
            )}

            {!token && (
              <button
                onClick={handleLogin}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                使用 GitHub 登录管理员账号
              </button>
            )}

            {token && status?.status === "pending" && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
              >
                {approving ? "授权中..." : "批准此 CLI 授权"}
              </button>
            )}

            {status?.status === "approved" && (
              <p className="text-green-600">授权已批准。请回到远端 CLI，等待它自动完成 token 领取。</p>
            )}

            {status?.status === "claimed" && (
              <p className="text-green-600">远端 CLI 已领取 token，授权流程已完成。</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
