"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Pencil, Save, Sparkles, Terminal, X } from "lucide-react";
import dynamic from "next/dynamic";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MarkdownRenderer } from "@/components/blocks/markdown-renderer";
import { useAdminSession } from "@/hooks/use-admin-session";
import { api, type Skill } from "@/lib/api";
import { richTextToPlain } from "@/lib/utils";
import { dateLocale, useI18n } from "@/lib/i18n";

const RichEditor = dynamic(
  () => import("@/components/blocks/rich-editor").then(m => m.RichEditor),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted/30" /> },
);
const RichViewerLazy = dynamic(
  () => import("@/components/blocks/rich-editor").then(m => m.RichViewer),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl bg-muted/30" /> },
);

function isBlockNoteJson(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (!t.startsWith("[")) return false;
  try { return Array.isArray(JSON.parse(t)); } catch { return false; }
}

type DetailState = "loading" | "ready" | "not_found";
type Draft = {
  name: string;
  slug: string;
  category: string;
  description: string;
  version: string;
  platform: string;
  install_command: string;
  source_url: string;
  status: string;
};

export default function SkillDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { locale } = useI18n();
  const zh = locale === "zh";
  const { token, isAdmin } = useAdminSession();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(draft);

  useEffect(() => {
    if (!slug) { setState("not_found"); return; }
    let cancelled = false;
    (async () => {
      setState("loading");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await api.skills.get(slug, { cache: "no-store", headers });
      if (cancelled) return;
      if (res.code !== 0 || !res.data) { setState("not_found"); return; }
      setSkill(res.data);
      setState("ready");
    })();
    return () => { cancelled = true; };
  }, [slug, token]);

  const openEdit = useCallback(() => {
    if (!skill) return;
    setDraft({
      name: skill.name,
      slug: skill.slug,
      category: skill.category,
      description: skill.description ?? "",
      version: skill.version,
      platform: skill.platform,
      install_command: skill.install_command ?? "",
      source_url: skill.source_url ?? "",
      status: skill.status,
    });
  }, [skill]);

  const save = async () => {
    if (!draft || !token || saving || !skill) return;
    setSaving(true);
    try {
      const payload: Partial<Skill> = {
        name: draft.name.trim() || undefined,
        slug: draft.slug.trim() || undefined,
        category: draft.category.trim() || undefined,
        description: draft.description || undefined,
        version: draft.version.trim() || undefined,
        platform: draft.platform.trim() || undefined,
        install_command: draft.install_command.trim() || undefined,
        source_url: draft.source_url.trim() || undefined,
        status: draft.status.trim() || undefined,
      };
      const res = await api.admin.skills.update(token, skill.slug, payload);
      if (res.code === 0 && res.data) {
        setSkill(res.data);
        setDraft(null);
        if (res.data.slug !== slug) router.replace(`/skills/${res.data.slug}`);
      }
    } finally { setSaving(false); }
  };

  const s = skill;
  const title = draft?.name ?? s?.name ?? "";
  const desc = draft?.description ?? s?.description ?? "";
  const category = draft?.category ?? s?.category ?? "";
  const platform = draft?.platform ?? s?.platform ?? "";
  const version = draft?.version ?? s?.version ?? "";
  const installCmd = draft?.install_command ?? s?.install_command ?? "";
  const status = draft?.status ?? s?.status ?? "";

  const d = (k: keyof Draft, v: string) =>
    setDraft(prev => prev ? { ...prev, [k]: v } : prev);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        {/* Back + admin */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/skills" className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {zh ? "返回 Skills 列表" : "Back to skills"}
          </Link>
          {isAdmin && s && !editing && (
            <button onClick={openEdit}
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-medium text-accent transition-all hover:bg-accent/10 hover:shadow-md">
              <Pencil className="h-3.5 w-3.5" />
              {zh ? "编辑 Skill" : "Edit Skill"}
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-2">
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground shadow-md disabled:opacity-50">
                <Save className="h-3.5 w-3.5" />
                {saving ? (zh ? "保存中..." : "Saving...") : (zh ? "保存" : "Save")}
              </button>
              <button onClick={() => setDraft(null)}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
                {zh ? "取消" : "Cancel"}
              </button>
            </div>
          )}
        </div>

        {state === "loading" && (
          <div className="flex items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {state === "not_found" && (
          <div className="rounded-3xl border border-dashed border-border/50 bg-card p-16 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-foreground">{zh ? "Skill 不存在" : "Skill not found"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{zh ? "该 Skill 不存在，或暂未公开。" : "This skill does not exist or is not public."}</p>
          </div>
        )}

        {state === "ready" && s && (
          <div className="space-y-8">
            {/* Hero header */}
            <header className="overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card via-card to-purple-500/[0.03]">
              <div className="px-8 py-8 sm:px-10 sm:py-10">
                {/* Category badges */}
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                    <Sparkles className="h-3 w-3" />
                    {editing
                      ? <input value={draft?.category ?? ""} onChange={e => d("category", e.target.value)}
                          className="w-24 bg-transparent text-purple-600 dark:text-purple-400 outline-none" />
                      : category.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                    v{editing
                      ? <input value={draft?.version ?? ""} onChange={e => d("version", e.target.value)}
                          className="w-12 bg-transparent outline-none inline" />
                      : version}
                  </span>
                  <span className="rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {editing
                      ? <input value={draft?.platform ?? ""} onChange={e => d("platform", e.target.value)}
                          className="w-16 bg-transparent outline-none" />
                      : platform}
                  </span>
                  {status !== "published" && (
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">{status}</span>
                  )}
                </div>

                {/* Title */}
                {editing ? (
                  <input value={draft?.name ?? ""} onChange={e => d("name", e.target.value)}
                    className="mb-4 w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-4xl lg:text-5xl"
                    placeholder={zh ? "Skill 名称" : "Skill name"} />
                ) : (
                  <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">{title}</h1>
                )}

                {/* Description preview — first sentence only */}
                {!editing && desc && (
                  <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
                    {richTextToPlain(desc).slice(0, 200)}
                  </p>
                )}

                {/* Highlights */}
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: zh ? "分类" : "Category", value: category || "-" },
                    { label: zh ? "平台" : "Platform", value: platform || "-" },
                    { label: zh ? "版本" : "Version", value: version ? `v${version}` : "-" },
                    { label: zh ? "安装量" : "Installs", value: `${s.install_count.toLocaleString()}` },
                  ].map(h => (
                    <div key={h.label} className="rounded-2xl border border-border/40 bg-background/60 px-4 py-3 backdrop-blur-sm">
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{h.label}</p>
                      <p className="text-sm font-medium text-foreground">{h.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </header>

            {/* Main content grid */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-6">
                {/* Description */}
                <div className="rounded-3xl border border-border/40 bg-card p-6 sm:p-8">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {zh ? "能力说明" : "Description"}
                  </h2>
                  {editing ? (
                    <RichEditor
                      key={`skill-desc-${s.slug}`}
                      initialContent={draft?.description ?? ""}
                      token={token ?? undefined}
                      onChange={json => d("description", json)}
                    />
                  ) : desc ? (
                    isBlockNoteJson(desc)
                      ? <RichViewerLazy content={desc} />
                      : <MarkdownRenderer content={desc} />
                  ) : (
                    <p className="text-sm italic text-muted-foreground/50">{zh ? "暂无说明" : "No description yet."}</p>
                  )}
                </div>

                {/* Install command */}
                {(installCmd || editing) && (
                  <div className="rounded-3xl border border-border/40 bg-card p-6 sm:p-8">
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                      <Terminal className="h-3.5 w-3.5" />
                      {zh ? "安装命令" : "Installation"}
                    </h2>
                    {editing ? (
                      <textarea value={draft?.install_command ?? ""} onChange={e => d("install_command", e.target.value)}
                        rows={6}
                        className="w-full rounded-xl border border-border/50 bg-muted/30 px-4 py-3 font-mono text-sm outline-none focus:border-accent/50" />
                    ) : installCmd ? (
                      <pre className="overflow-x-auto rounded-xl bg-muted/30 px-4 py-3 font-mono text-sm">
                        <code>{installCmd}</code>
                      </pre>
                    ) : null}
                  </div>
                )}

                {/* Source link */}
                {s.source_url && !editing && (
                  <div className="flex flex-wrap gap-3">
                    <a href={s.source_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:border-accent/30 hover:bg-accent/5 hover:shadow-md">
                      {zh ? "查看源码" : "View Source"}
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                {editing ? (
                  <div className="rounded-3xl border border-purple-500/20 bg-card p-5">
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">{zh ? "编辑属性" : "Properties"}</h2>
                    <div className="space-y-4 text-sm">
                      {[
                        { label: "Slug", key: "slug" as const },
                        { label: zh ? "源码 URL" : "Source URL", key: "source_url" as const },
                        { label: zh ? "状态" : "Status", key: "status" as const },
                      ].map(f => (
                        <div key={f.key}>
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{f.label}</p>
                          <input value={String(draft?.[f.key] ?? "")} onChange={e => d(f.key, e.target.value)}
                            className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-accent/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-3xl border border-border/40 bg-card p-5">
                      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                        {zh ? "Skill 信息" : "Overview"}
                      </h2>
                      <div className="space-y-3 text-sm">
                        {[
                          { label: zh ? "分类" : "Category", value: s.category },
                          { label: zh ? "平台" : "Platform", value: s.platform },
                          { label: zh ? "版本" : "Version", value: `v${s.version}` },
                          { label: zh ? "安装量" : "Installs", value: s.install_count.toLocaleString() },
                          { label: zh ? "更新时间" : "Updated", value: new Date(s.updated_at).toLocaleDateString(dateLocale(locale)) },
                        ].map(item => (
                          <div key={item.label} className="rounded-2xl bg-muted/30 px-4 py-2.5">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
                            <p className="mt-0.5 font-medium text-foreground">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {s.source_url && (
                      <div className="rounded-3xl border border-border/40 bg-card p-5">
                        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                          {zh ? "快速操作" : "Actions"}
                        </h2>
                        <a href={s.source_url} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between rounded-2xl border border-border/50 px-4 py-3 text-sm transition-colors hover:bg-muted/30">
                          <span>{zh ? "查看源码" : "Source Code"}</span>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </a>
                      </div>
                    )}
                  </>
                )}
              </aside>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
