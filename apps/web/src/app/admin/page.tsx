"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { api, type Project, type Skill, type Post, type GuestbookEntry } from "@/lib/api";
import { Navbar } from "@/components/layout/navbar";
import { LocaleToggle } from "@/components/layout/locale-toggle";

/* ─── token helper ─── */
const TOKEN_KEY = "neo-admin-token";

function useToken() {
  const [token, setTokenState] = useState<string | null>(null);
  useEffect(() => { setTokenState(localStorage.getItem(TOKEN_KEY)); }, []);
  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
  }, []);
  return { token, setToken };
}

/* ─── toast ─── */
type ToastType = "success" | "error" | "info";

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const show = useCallback((msg: string, type: ToastType = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function Toast({ toast }: { toast: { msg: string; type: ToastType } | null }) {
  if (!toast) return null;
  const bg = toast.type === "success" ? "bg-green-500/10 text-green-600 border-green-500/20"
    : toast.type === "error" ? "bg-red-500/10 text-red-500 border-red-500/20"
    : "bg-blue-500/10 text-blue-500 border-blue-500/20";
  return (
    <div className={`fixed top-20 right-6 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-sm transition-all ${bg}`}>
      {toast.msg}
    </div>
  );
}

/* ─── image compress util ─── */
function compressImage(file: File, maxW = 1600, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w <= maxW) { resolve(file); return; }
      const ratio = maxW / w;
      w = maxW;
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* ─── tabs ─── */
type Tab = "projects" | "skills" | "blog" | "guestbook" | "uploads" | "chat";
const TABS: { key: Tab; label: TKey }[] = [
  { key: "projects", label: "admin.projects" },
  { key: "skills", label: "admin.skills" },
  { key: "blog", label: "admin.blog" },
  { key: "guestbook", label: "admin.guestbook" },
  { key: "uploads", label: "admin.uploads" },
  { key: "chat", label: "admin.chatSessions" },
];

/* ─── main ─── */
export default function AdminPage() {
  const { t } = useI18n();
  const { token, setToken } = useToken();
  const [user, setUser] = useState<{ username: string; role: string; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("projects");
  const { toast, show } = useToast();

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (tabParam && TABS.some((item) => item.key === tabParam)) {
      setTab(tabParam);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const adminUrl = `${window.location.origin}/admin`;
      window.history.replaceState({}, "", "/admin");
      const cbUrl = new URL(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/github/callback`);
      cbUrl.searchParams.set("code", code);
      cbUrl.searchParams.set("redirect_uri", adminUrl);
      fetch(cbUrl.toString())
        .then(r => r.json())
        .then(d => {
          if (d.data?.access_token) {
            setToken(d.data.access_token);
            setUser(d.data.user);
          } else console.error("Login failed:", d);
          setLoading(false);
        })
        .catch((e) => { console.error("Login error:", e); setLoading(false); });
      return;
    }
    if (!token) { setLoading(false); return; }
    api.auth.me(token).then(r => {
      if (r.data && r.data.role === "admin") setUser(r.data);
      else { setToken(null); setUser(null); }
      setLoading(false);
    }).catch(() => { setLoading(false); setToken(null); });
  }, [token, setToken]);

  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!token || !user) return <LoginPanel t={t} />;
  if (user.role !== "admin") return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <p className="text-lg text-red-500">{t("admin.noAccess")}</p>
      <button onClick={() => setToken(null)} className="text-sm text-muted-foreground underline">{t("admin.logout")}</button>
    </div>
  );

  return (
    <>
      <Navbar />
      <Toast toast={toast} />
      <main className="mx-auto max-w-7xl px-6 pt-24 pb-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
          <div className="flex items-center gap-3">
            {user.avatar_url && <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full" />}
            <span className="text-sm text-muted-foreground">{user.username}</span>
            <LocaleToggle />
            <button onClick={() => setToken(null)} className="rounded-lg border border-red-300/30 px-3 py-1 text-xs text-red-500 hover:bg-red-50/10">
              {t("admin.logout")}
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-1 rounded-xl bg-muted/30 p-1">
          {TABS.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === tb.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t(tb.label)}
            </button>
          ))}
        </div>

        {tab === "projects" && <ProjectsPanel token={token} t={t} toast={show} />}
        {tab === "skills" && <SkillsPanel token={token} t={t} toast={show} />}
        {tab === "blog" && <BlogPanel token={token} t={t} toast={show} />}
        {tab === "guestbook" && <GuestbookPanel token={token} t={t} toast={show} />}
        {tab === "uploads" && <UploadsPanel token={token} t={t} toast={show} />}
        {tab === "chat" && <ChatSessionsPanel token={token} t={t} toast={show} />}
      </main>
    </>
  );
}

/* ─── Login ─── */
function LoginPanel({ t }: { t: (k: TKey) => string }) {
  const handleLogin = async () => {
    const res = await api.auth.githubLoginUrl();
    if (res.data?.url) {
      const url = new URL(res.data.url);
      url.searchParams.set("redirect_uri", `${window.location.origin}/admin`);
      window.location.href = url.toString();
    }
  };
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">{t("admin.login")}</h1>
      <p className="text-sm text-muted-foreground">{t("admin.loginDesc")}</p>
      <button onClick={handleLogin}
        className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-stone-800 transition-colors">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        {t("admin.loginBtn")}
      </button>
    </div>
  );
}

/* ─── type for panel props ─── */
interface PanelProps {
  token: string;
  t: (k: TKey) => string;
  toast: (msg: string, type?: ToastType) => void;
}

/* ─── GitHub Import Panel ─── */
interface GhRepo { name: string; full_name: string; description: string | null; html_url: string; language: string | null; stargazers_count: number; topics: string[]; homepage: string | null; updated_at: string; }

function GitHubImportPanel({ token, t, toast, onDone }: PanelProps & { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [existingSlugs, setExistingSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.projects.list("page_size=200", { cache: "no-store" }).then(r => {
      const slugs = new Set((r.data ?? []).map(p => p.slug));
      setExistingSlugs(slugs);
    });
  }, []);

  const fetchRepos = async () => {
    setFetching(true);
    const res = await api.admin.github.repos(token, username || undefined);
    if (res.data) setRepos(res.data);
    else toast(res.message, "error");
    setFetching(false);
  };

  const toSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  const toggleAll = () => {
    if (selected.size === repos.filter(r => !existingSlugs.has(toSlug(r.name))).length) setSelected(new Set());
    else setSelected(new Set(repos.filter(r => !existingSlugs.has(toSlug(r.name))).map(r => r.full_name)));
  };

  const toggle = (fn: string) => {
    const next = new Set(selected);
    if (next.has(fn)) next.delete(fn); else next.add(fn);
    setSelected(next);
  };

  const doImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    const repoList = Array.from(selected).map(fn => ({ full_name: fn }));
    const res = await api.admin.github.import(token, repoList);
    if (res.code === 0 && res.data) {
      toast(`${t("admin.ghImported")} (${res.data.created.length} imported, ${res.data.skipped.length} skipped)`, "success");
      onDone();
    } else toast(`${t("admin.ghImportFailed")}: ${res.message}`, "error");
    setImporting(false);
  };

  return (
    <div className="mb-6 rounded-2xl border border-accent/30 bg-card p-6">
      <p className="mb-4 text-sm text-muted-foreground">{t("admin.ghImportDesc")}</p>
      <div className="mb-4 flex gap-2">
        <input type="text" value={username} onChange={e => setUsername(e.target.value)}
          placeholder={t("admin.ghUsername")}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          onKeyDown={e => e.key === "Enter" && fetchRepos()} />
        <button onClick={fetchRepos} disabled={fetching}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">
          {fetching ? t("admin.ghFetching") : t("admin.ghFetch")}
        </button>
      </div>

      {repos.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <button onClick={toggleAll} className="text-xs text-accent hover:underline">{t("admin.ghSelectAll")}</button>
            <button onClick={doImport} disabled={importing || selected.size === 0}
              className="rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {importing ? t("admin.ghImporting") : `${t("admin.ghImportSelected")} (${selected.size})`}
            </button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {repos.map(r => {
              const slug = toSlug(r.name);
              const exists = existingSlugs.has(slug);
              return (
                <label key={r.full_name}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${exists ? "border-border/30 opacity-50" : selected.has(r.full_name) ? "border-accent/50 bg-accent/5" : "border-border/50 hover:bg-muted/20"}`}>
                  <input type="checkbox" disabled={exists} checked={selected.has(r.full_name)} onChange={() => toggle(r.full_name)}
                    className="mt-1 h-4 w-4 rounded border-border" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      {r.language && <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.language}</span>}
                      <span className="shrink-0 text-[10px] text-muted-foreground">{r.stargazers_count} {t("admin.ghStars")}</span>
                      {exists && <span className="shrink-0 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-600">{t("admin.ghAlreadyExists")}</span>}
                    </div>
                    {r.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.description}</p>}
                    {r.topics.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{r.topics.slice(0, 5).map(tp => <span key={tp} className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">{tp}</span>)}</div>}
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}
      {repos.length === 0 && !fetching && <p className="py-4 text-center text-sm text-muted-foreground">{t("admin.ghNoRepos")}</p>}
    </div>
  );
}

/* ─── Projects Panel ─── */
const PROJECT_CREATE_KEYS = ["slug", "title", "description", "category", "tech_stack", "cover_url", "repo_url", "demo_url", "hf_url", "featured", "status"] as const;

function projectFields(t: (k: TKey) => string): FieldDef[] {
  return [
    { key: "title", label: t("admin.fTitle"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "category", label: t("admin.fCategory"), type: "select", options: ["llm", "vla", "multimodal", "world_model", "tool"] },
    { key: "description", label: t("admin.fDescription"), type: "textarea" },
    { key: "tech_stack", label: t("admin.fTechStack"), type: "text" },
    { key: "cover_url", label: t("admin.fCoverUrl"), type: "url_with_upload" },
    { key: "repo_url", label: t("admin.fRepoUrl"), type: "text" },
    { key: "demo_url", label: t("admin.fDemoUrl"), type: "text" },
    { key: "hf_url", label: t("admin.fHfUrl"), type: "text" },
    { key: "featured", label: t("admin.fFeatured"), type: "checkbox" },
    { key: "status", label: t("admin.fStatus"), type: "select", options: ["published", "draft", "archived"] },
  ];
}

function pickKeys<T extends Record<string, unknown>>(data: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (!(k in data)) continue;
    let v = data[k];
    if (k === "tech_stack" && Array.isArray(v)) {
      v = (v as string[]).filter(s => s.length > 0);
      if ((v as string[]).length === 0) v = null;
    }
    if (v === "") v = null;
    out[k] = v;
  }
  return out as Partial<T>;
}

function ProjectsPanel({ token, t, toast }: PanelProps) {
  const [showGhImport, setShowGhImport] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.projects.list("page_size=100", { cache: "no-store" }).then(r => setProjects(r.data ?? []));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const payload = pickKeys(editing, [...PROJECT_CREATE_KEYS]);
      const res = isNew
        ? await api.admin.projects.create(token, payload)
        : await api.admin.projects.update(token, editing.slug!, payload);
      if (res.code === 0) { toast(t("admin.saved")); setEditing(null); load(); }
      else { toast(`${t("admin.saveFailed")}: ${res.message}`, "error"); console.error("Save response:", res); }
    } catch (e) { toast(t("admin.saveFailed"), "error"); console.error("Save error:", e); }
    finally { setSaving(false); }
  };

  const del = async (slug: string) => {
    if (!confirm(t("admin.confirm"))) return;
    const res = await api.admin.projects.delete(token, slug);
    if (res.code === 0) { toast(t("admin.deleted")); load(); }
    else toast(t("admin.deleteFailed"), "error");
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button onClick={() => setShowGhImport(v => !v)}
          className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20">
          {t("admin.ghImport")}
        </button>
        <button onClick={() => setEditing({ title: "", slug: "", category: "llm", description: "", status: "published", featured: false })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">{t("admin.create")}</button>
      </div>
      {showGhImport && <GitHubImportPanel token={token} t={t} toast={toast} onDone={() => { setShowGhImport(false); load(); }} />}
      {editing && <EditForm fields={projectFields(t)} data={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} t={t} saving={saving} token={token} />}
      <div className="space-y-2">
        {projects.map(p => (
          <div key={p.slug} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4">
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.slug} · {p.category} · {p.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...p })} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">{t("admin.edit")}</button>
              <button onClick={() => del(p.slug)}
                className="rounded-lg border border-red-300/30 px-3 py-1 text-xs text-red-500 hover:bg-red-50/10">{t("admin.delete")}</button>
            </div>
          </div>
        ))}
        {projects.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("admin.noData")}</p>}
      </div>
    </div>
  );
}

/* ─── Skills Panel ─── */
const SKILL_CREATE_KEYS = ["slug", "name", "description", "category", "version", "platform", "install_command", "source_url", "status"] as const;

function skillFields(t: (k: TKey) => string): FieldDef[] {
  return [
    { key: "name", label: t("admin.fName"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "category", label: t("admin.fCategory"), type: "select", options: ["development", "documentation", "devops", "ml", "data"] },
    { key: "description", label: t("admin.fDescription"), type: "textarea" },
    { key: "version", label: t("admin.fVersion"), type: "text" },
    { key: "platform", label: t("admin.fPlatform"), type: "select", options: ["openclaw", "mcp", "other"] },
    { key: "install_command", label: t("admin.fInstallCmd"), type: "text" },
    { key: "source_url", label: t("admin.fSourceUrl"), type: "text" },
    { key: "status", label: t("admin.fStatus"), type: "select", options: ["published", "draft"] },
  ];
}

function SkillsPanel({ token, t, toast }: PanelProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [editing, setEditing] = useState<Partial<Skill> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.skills.list("page_size=100", { cache: "no-store" }).then(r => setSkills(r.data ?? []));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const payload = pickKeys(editing, [...SKILL_CREATE_KEYS]);
      const res = isNew
        ? await api.admin.skills.create(token, payload)
        : await api.admin.skills.update(token, editing.slug!, payload);
      if (res.code === 0) { toast(t("admin.saved")); setEditing(null); load(); }
      else { toast(`${t("admin.saveFailed")}: ${res.message}`, "error"); console.error("Save response:", res); }
    } catch (e) { toast(t("admin.saveFailed"), "error"); console.error("Save error:", e); }
    finally { setSaving(false); }
  };

  const del = async (slug: string) => {
    if (!confirm(t("admin.confirm"))) return;
    const res = await api.admin.skills.delete(token, slug);
    if (res.code === 0) { toast(t("admin.deleted")); load(); }
    else toast(t("admin.deleteFailed"), "error");
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setEditing({ name: "", slug: "", category: "development", description: "", status: "published", version: "0.1.0", platform: "openclaw" })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">{t("admin.create")}</button>
      </div>
      {editing && <EditForm fields={skillFields(t)} data={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} t={t} saving={saving} token={token} />}
      <div className="space-y-2">
        {skills.map(s => (
          <div key={s.slug} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4">
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.slug} · {s.category} · v{s.version}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...s })} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">{t("admin.edit")}</button>
              <button onClick={() => del(s.slug)}
                className="rounded-lg border border-red-300/30 px-3 py-1 text-xs text-red-500 hover:bg-red-50/10">{t("admin.delete")}</button>
            </div>
          </div>
        ))}
        {skills.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("admin.noData")}</p>}
      </div>
    </div>
  );
}

/* ─── Blog Panel ─── */
const POST_CREATE_KEYS = ["slug", "title", "summary", "content", "tags", "cover_url", "published"] as const;

function blogFields(t: (k: TKey) => string): FieldDef[] {
  return [
    { key: "title", label: t("admin.fTitle"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "summary", label: t("admin.fSummary"), type: "textarea" },
    { key: "tags", label: t("admin.fTags"), type: "text" },
    { key: "cover_url", label: t("admin.fCoverUrl"), type: "url_with_upload" },
    { key: "published", label: t("admin.fPublished"), type: "checkbox" },
    { key: "content", label: t("admin.fContent"), type: "textarea" },
  ];
}

async function readFileAsText(file: File): Promise<string> {
  if (file.name.endsWith(".pdf")) {
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let text = "";
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0x28) {
        let j = i + 1;
        let chunk = "";
        while (j < bytes.length && bytes[j] !== 0x29) { chunk += String.fromCharCode(bytes[j]); j++; }
        if (chunk.length > 2) text += chunk;
      }
    }
    if (text.length < 50) {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const raw = decoder.decode(arrayBuf);
      const streamMatches = raw.match(/BT[\s\S]*?ET/g);
      if (streamMatches) text = streamMatches.map(m => m.replace(/BT|ET|Tf|Td|Tj|TJ|\[|\]|\(|\)|\/\w+\s[\d.]+/g, "").trim()).join("\n");
    }
    return text.length > 10 ? text : `[PDF imported: ${file.name}]\n\nPDF content extraction is limited in browser. Please paste the text content manually or upload the PDF to the Media tab and link it.`;
  }
  return file.text();
}

function BlogPanel({ token, t, toast }: PanelProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.posts.list("page_size=100", { cache: "no-store" }).then(r => setPosts(r.data ?? []));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const raw = pickKeys(editing, [...POST_CREATE_KEYS]);
      if (raw.tags && typeof raw.tags === "string") {
        raw.tags = (raw.tags as unknown as string).split(",").map((s: string) => s.trim()).filter(Boolean) as unknown as string[];
      }
      const res = isNew
        ? await api.admin.posts.create(token, raw)
        : await api.admin.posts.update(token, editing.slug!, raw);
      if (res.code === 0) { toast(t("admin.saved")); setEditing(null); setPreview(false); load(); }
      else { toast(`${t("admin.saveFailed")}: ${res.message}`, "error"); }
    } catch (e) { toast(t("admin.saveFailed"), "error"); console.error(e); }
    finally { setSaving(false); }
  };

  const del = async (slug: string) => {
    if (!confirm(t("admin.confirm"))) return;
    const res = await api.admin.posts.delete(token, slug);
    if (res.code === 0) { toast(t("admin.deleted")); load(); }
    else toast(t("admin.deleteFailed"), "error");
  };

  const importDoc = async (file: File) => {
    const text = await readFileAsText(file);
    const name = file.name.replace(/\.[^.]+$/, "");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").slice(0, 60);
    setEditing(prev => ({ ...prev, content: text, title: prev?.title || name, slug: prev?.slug || slug }));
    toast(t("admin.uploaded"), "info");
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button onClick={() => setEditing({ title: "", slug: "", summary: "", content: "", tags: [], published: false })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">{t("admin.create")}</button>
      </div>

      {editing && (
        <div className="mb-6 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => docRef.current?.click()}
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20">
              {t("admin.uploadDoc")}
            </button>
            <input ref={docRef} type="file" accept=".md,.markdown,.txt,.pdf,.html" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importDoc(f); e.target.value = ""; }} />
            <button onClick={() => setPreview(!preview)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${preview ? "border-accent bg-accent/20 text-accent" : "text-muted-foreground hover:bg-muted"}`}>
              {t("admin.contentPreview")}
            </button>
          </div>

          <EditForm fields={blogFields(t)} data={{...editing, tags: Array.isArray(editing.tags) ? editing.tags.join(", ") : (editing.tags || "")}}
            onChange={(d) => setEditing({...d, tags: typeof d.tags === "string" ? d.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : d.tags} as Partial<Post>)}
            onSave={save} onCancel={() => { setEditing(null); setPreview(false); }} t={t} saving={saving} token={token} />

          {preview && editing.content && (
            <div className="rounded-2xl border border-border/50 bg-card p-6 prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: simpleMarkdown(editing.content) }} />
          )}
        </div>
      )}

      <div className="space-y-2">
        {posts.map(p => (
          <div key={p.slug} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4">
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.slug} · {p.published ? "✓ Published" : "Draft"} · {p.reading_time} min · {p.views} views</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing({ ...p }); setPreview(false); }} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">{t("admin.edit")}</button>
              <button onClick={() => del(p.slug)}
                className="rounded-lg border border-red-300/30 px-3 py-1 text-xs text-red-500 hover:bg-red-50/10">{t("admin.delete")}</button>
            </div>
          </div>
        ))}
        {posts.length === 0 && !editing && <p className="py-8 text-center text-muted-foreground">{t("admin.noData")}</p>}
      </div>
    </div>
  );
}

function simpleMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent underline">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>").replace(/$/, "</p>");
}

/* ─── Guestbook Panel ─── */
function GuestbookPanel({ token, t, toast }: PanelProps) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);

  const load = useCallback(() => {
    api.guestbook.list({ cache: "no-store" }).then(r => setEntries(r.data ?? []));
  }, []);
  useEffect(load, [load]);

  const del = async (id: number) => {
    if (!confirm(t("admin.confirm"))) return;
    const res = await api.admin.guestbook.delete(token, id);
    if (res.code === 0) { toast(t("admin.deleted")); load(); }
    else toast(t("admin.deleteFailed"), "error");
  };

  return (
    <div className="space-y-2">
      {entries.map(e => (
        <div key={e.id} className="flex items-start justify-between rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-start gap-3">
            {e.user.avatar_url && <img src={e.user.avatar_url} alt="" className="h-8 w-8 rounded-full" />}
            <div>
              <p className="text-sm font-medium">{e.user.username}</p>
              <p className="text-sm text-muted-foreground">{e.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <button onClick={() => del(e.id)}
            className="rounded-lg border border-red-300/30 px-3 py-1 text-xs text-red-500 hover:bg-red-50/10">{t("admin.delete")}</button>
        </div>
      ))}
      {entries.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("admin.noData")}</p>}
    </div>
  );
}

/* ─── Uploads Panel ─── */
function UploadsPanel({ token, t, toast }: PanelProps) {
  const [files, setFiles] = useState<{ url: string; filename: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<{ src: string; name: string; size: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    const previewItems: { src: string; name: string; size: string }[] = [];
    for (const f of Array.from(fileList)) {
      if (f.type.startsWith("image/")) {
        previewItems.push({ src: URL.createObjectURL(f), name: f.name, size: `${(f.size / 1024).toFixed(0)}KB` });
      }
    }
    setPreviews(previewItems);

    let successCount = 0;
    for (const file of Array.from(fileList)) {
      const compressed = await compressImage(file);
      const res = await api.admin.upload(token, compressed);
      if (res.data) { setFiles(prev => [res.data!, ...prev]); successCount++; }
      else { toast(`${t("admin.uploadFailed")}: ${file.name}`, "error"); }
    }

    previewItems.forEach(p => URL.revokeObjectURL(p.src));
    setPreviews([]);
    setUploading(false);
    if (successCount > 0) toast(`${t("admin.uploaded")} (${successCount})`);
  };

  const copyUrl = (url: string) => {
    const fullUrl = url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${url}`;
    navigator.clipboard.writeText(fullUrl);
    toast(t("admin.copied"), "info");
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-accent/70", "bg-muted/30"); }}
        onDragLeave={e => { e.currentTarget.classList.remove("border-accent/70", "bg-muted/30"); }}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("border-accent/70", "bg-muted/30"); handleUpload(e.dataTransfer.files); }}
        className="mb-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-12 transition-colors hover:border-accent/50 hover:bg-muted/20"
      >
        <svg className="h-8 w-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium">{uploading ? t("admin.uploading") : t("admin.dragDrop")}</p>
        <p className="text-xs text-muted-foreground">{t("admin.dragHint")}</p>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
      </div>

      {previews.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {previews.map((p, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-border/50 bg-card">
              <img src={p.src} alt={p.name} className="h-32 w-full object-cover opacity-50" />
              <div className="p-2"><p className="truncate text-xs text-muted-foreground">{p.name} · {p.size}</p></div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((f, i) => {
            const isVideo = /\.(mp4|webm|mov)$/i.test(f.url);
            const src = f.url.startsWith("http") ? f.url : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${f.url}`;
            return (
              <div key={i} className="group overflow-hidden rounded-xl border border-border/50 bg-card">
                {isVideo
                  ? <video src={src} className="h-32 w-full object-cover" controls />
                  : <img src={src} alt={f.filename} className="h-32 w-full object-cover" />}
                <div className="flex items-center justify-between p-2">
                  <p className="truncate text-xs text-muted-foreground">{f.filename}</p>
                  <button onClick={() => copyUrl(f.url)}
                    className="shrink-0 text-xs text-accent hover:underline">{t("admin.copyUrl")}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {files.length === 0 && !uploading && previews.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">{t("admin.noData")}</p>
      )}
    </div>
  );
}

/* ─── Chat Sessions Panel ─── */
function ChatSessionsPanel({ token, t }: PanelProps) {
  const [sessions, setSessions] = useState<{ session_id: string; visitor_id: string; msg_count: number; started_at: string; last_at: string }[]>([]);
  const [detail, setDetail] = useState<{ session_id: string; messages: { id: number; role: string; content: string; created_at: string }[] } | null>(null);

  const load = useCallback(() => {
    api.admin.chat.sessions(token).then(r => setSessions(r.data ?? []));
  }, [token]);
  useEffect(load, [load]);

  const viewSession = async (sid: string) => {
    const res = await api.admin.chat.sessionMessages(token, sid);
    if (res.data) setDetail({ session_id: sid, messages: res.data });
  };

  if (detail) {
    return (
      <div>
        <button onClick={() => setDetail(null)} className="mb-4 flex items-center gap-1 text-sm text-accent hover:underline">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("admin.chatBack")}
        </button>
        <div className="mb-3 text-xs text-muted-foreground">Session: {detail.session_id}</div>
        <div className="space-y-3">
          {detail.messages.map(m => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-gradient-to-r from-red-600/90 to-orange-500/90 text-white"
                  : "bg-muted text-foreground"
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className="mt-1 text-[10px] opacity-50">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map(s => (
        <div key={s.session_id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4">
          <div>
            <p className="text-sm font-medium font-mono">{s.session_id}</p>
            <p className="text-xs text-muted-foreground">
              Visitor: {s.visitor_id?.slice(0, 8) ?? "—"} · {s.msg_count} {t("admin.chatMessages")} · {new Date(s.last_at).toLocaleString()}
            </p>
          </div>
          <button onClick={() => viewSession(s.session_id)}
            className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">{t("admin.chatViewDetail")}</button>
        </div>
      ))}
      {sessions.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("admin.chatNoSessions")}</p>}
    </div>
  );
}

/* ─── Shared Edit Form ─── */
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "url_with_upload";
  options?: string[];
}

function EditForm({ fields, data, onChange, onSave, onCancel, t, saving, token }: {
  fields: FieldDef[];
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
  t: (k: TKey) => string;
  saving: boolean;
  token?: string;
}) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const handleFileUpload = async (key: string, file: File) => {
    if (!token) return;
    setUploadingField(key);
    const compressed = await compressImage(file);
    const res = await api.admin.upload(token, compressed);
    if (res.data) {
      const url = res.data.url.startsWith("http") ? res.data.url : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${res.data.url}`;
      set(key, url);
    }
    setUploadingField(null);
  };

  return (
    <div className="mb-6 rounded-2xl border border-accent/30 bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(f => {
          const rawValue = data[f.key];
          const stringValue = String(rawValue ?? "");
          const previewUrl = typeof rawValue === "string" ? rawValue.trim() : "";

          return (
          <div key={f.key} className={f.type === "textarea" || f.type === "url_with_upload" ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</label>

            {f.type === "text" && (
              <input type="text"
                value={f.key === "tech_stack" ? (Array.isArray(rawValue) ? (rawValue as string[]).join(", ") : stringValue) : stringValue}
                onChange={e => set(f.key, f.key === "tech_stack" ? e.target.value.split(",").map(s => s.trim()) : e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            )}

            {f.type === "url_with_upload" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="text" value={stringValue} onChange={e => set(f.key, e.target.value)}
                    placeholder="https://... or upload"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                  <button type="button"
                    disabled={uploadingField === f.key}
                    onClick={() => { fileRef.current?.setAttribute("data-field", f.key); fileRef.current?.click(); }}
                    className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50">
                    {uploadingField === f.key ? t("admin.uploading") : t("admin.upload")}
                  </button>
                </div>
                {previewUrl.length > 0 && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
                    <img src={previewUrl} alt="preview" className="h-16 w-24 rounded-md object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="truncate text-xs text-muted-foreground">{previewUrl}</span>
                  </div>
                )}
              </div>
            )}

            {f.type === "textarea" && (
              <textarea value={stringValue} onChange={e => set(f.key, e.target.value)} rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            )}

            {f.type === "select" && (
              <select value={stringValue} onChange={e => set(f.key, e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none">
                {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {f.type === "checkbox" && (
              <input type="checkbox" checked={Boolean(rawValue)} onChange={e => set(f.key, e.target.checked)}
                className="h-4 w-4 rounded border-border" />
            )}
          </div>
        );})}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const field = fileRef.current?.getAttribute("data-field");
          if (file && field) await handleFileUpload(field, file);
          e.target.value = "";
        }} />

      <div className="mt-4 flex gap-3">
        <button onClick={onSave} disabled={saving}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">
          {saving ? t("admin.saving") : t("admin.save")}
        </button>
        <button onClick={onCancel} className="rounded-lg border px-5 py-2 text-sm text-muted-foreground hover:bg-muted">{t("admin.cancel")}</button>
      </div>
    </div>
  );
}
