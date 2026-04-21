"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ExternalLink, FolderKanban, GitBranch, Globe, Pencil, Save, Upload, X } from "lucide-react";
import dynamic from "next/dynamic";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MarkdownRenderer } from "@/components/blocks/markdown-renderer";
import { useAdminSession } from "@/hooks/use-admin-session";
import { api, type Project } from "@/lib/api";
import { richTextToPlain } from "@/lib/utils";
import { dateLocale, useI18n } from "@/lib/i18n";
import { uploadImage } from "@/lib/image-upload";

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

function extractSubtitle(raw: string): string {
  if (!raw) return "";
  const t = raw.trim();
  if (t.startsWith("[")) {
    const plain = richTextToPlain(raw);
    if (plain && plain !== t) return plain.slice(0, 200);
  }
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith("#") || l.startsWith("```") || l.startsWith("|") || l.startsWith("-") || l.startsWith("*") || l.startsWith(">")) continue;
    return l.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "").slice(0, 200);
  }
  return "";
}

type DetailState = "loading" | "ready" | "not_found";
type Draft = {
  title: string;
  slug: string;
  category: string;
  description: string;
  tech_stack: string;
  cover_url: string;
  repo_url: string;
  demo_url: string;
  hf_url: string;
  featured: boolean;
  status: string;
};

const LINK_ICONS: Record<string, typeof Globe> = { GitHub: GitBranch, Demo: Globe, HuggingFace: ExternalLink };
const PROJECT_CATEGORIES = ["llm", "vla", "multimodal", "world_model", "tool"] as const;
const STATUS_OPTIONS = ["published", "draft", "archived"] as const;

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { locale } = useI18n();
  const zh = locale === "zh";
  const { token, isAdmin } = useAdminSession();
  const [project, setProject] = useState<Project | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(draft);

  useEffect(() => {
    if (!slug) { setState("not_found"); return; }
    let cancelled = false;
    (async () => {
      setState("loading");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await api.projects.get(slug, { cache: "no-store", headers });
      if (cancelled) return;
      if (res.code !== 0 || !res.data) { setState("not_found"); return; }
      setProject(res.data);
      setState("ready");
    })();
    return () => { cancelled = true; };
  }, [slug, token]);

  const openEdit = useCallback(() => {
    if (!project) return;
    setDraft({
      title: project.title,
      slug: project.slug,
      category: project.category,
      description: project.description ?? "",
      tech_stack: (project.tech_stack ?? []).join(", "),
      cover_url: project.cover_url ?? "",
      repo_url: project.repo_url ?? "",
      demo_url: project.demo_url ?? "",
      hf_url: project.hf_url ?? "",
      featured: project.featured,
      status: project.status,
    });
  }, [project]);

  const save = async () => {
    if (!draft || !token || saving || !project) return;
    setSaving(true);
    try {
      const payload: Partial<Project> = {
        title: draft.title.trim() || undefined,
        slug: draft.slug.trim() || undefined,
        category: draft.category.trim() || undefined,
        description: draft.description || undefined,
        tech_stack: draft.tech_stack.split(",").map(s => s.trim()).filter(Boolean),
        cover_url: draft.cover_url.trim() || undefined,
        repo_url: draft.repo_url.trim() || undefined,
        demo_url: draft.demo_url.trim() || undefined,
        hf_url: draft.hf_url.trim() || undefined,
        featured: draft.featured,
        status: draft.status.trim() || undefined,
      };
      const res = await api.admin.projects.update(token, project.slug, payload);
      if (res.code === 0 && res.data) {
        setProject(res.data);
        setDraft(null);
        if (res.data.slug !== slug) router.replace(`/projects/${res.data.slug}`);
      }
    } finally { setSaving(false); }
  };

  const p = project;
  const title = draft?.title ?? p?.title ?? "";
  const desc = draft?.description ?? p?.description ?? "";
  const category = draft?.category ?? p?.category ?? "";
  const status = draft?.status ?? p?.status ?? "";
  const stack = (draft?.tech_stack ?? (p?.tech_stack ?? []).join(", ")).split(",").map(s => s.trim()).filter(Boolean);
  const cover = draft?.cover_url ?? p?.cover_url ?? "";
  const subtitle = useMemo(() => extractSubtitle(desc), [desc]);

  const links = useMemo(() => {
    if (!p) return [];
    const all: { label: string; href: string }[] = [];
    if (p.repo_url) all.push({ label: "GitHub", href: p.repo_url });
    if (p.demo_url && p.demo_url !== p.repo_url) all.push({ label: "Demo", href: p.demo_url });
    if (p.hf_url) all.push({ label: "HuggingFace", href: p.hf_url });
    return all;
  }, [p]);

  const d = (k: keyof Draft, v: string | boolean) =>
    setDraft(prev => prev ? { ...prev, [k]: v } : prev);

  const handleCoverUpload = async (file: File) => {
    if (!token) return;
    setUploadingCover(true);
    const url = await uploadImage(token, file);
    if (url) d("cover_url", url);
    setUploadingCover(false);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        {/* Nav bar */}
        <div className="mb-10 flex items-center justify-between">
          <Link href="/projects" className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {zh ? "返回项目列表" : "Back to projects"}
          </Link>
          {isAdmin && p && !editing && (
            <button onClick={openEdit}
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-medium text-accent transition-all hover:bg-accent/10 hover:shadow-md">
              <Pencil className="h-3.5 w-3.5" />
              {zh ? "编辑项目" : "Edit Project"}
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
            <FolderKanban className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-foreground">{zh ? "项目不存在" : "Project not found"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{zh ? "该项目不存在，或暂未公开。" : "This project does not exist or is not public."}</p>
          </div>
        )}

        {state === "ready" && p && (
          <div className="space-y-10">
            {/* ─── Hero ─── */}
            <header className="relative overflow-hidden rounded-[2rem] border border-border/30 bg-card">
              {/* Decorative background */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(251,146,60,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.05),transparent_50%)]" />

              {/* Cover image */}
              {cover && !editing && (
                <div className="relative h-56 w-full overflow-hidden sm:h-72 lg:h-80">
                  <img src={cover} alt={title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                </div>
              )}

              <div className="relative px-8 pb-10 sm:px-10" style={{ marginTop: cover && !editing ? "-4rem" : "0" }}>
                <div className={cover && !editing ? "" : "pt-10"}>
                  {/* Badges */}
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                      <FolderKanban className="h-3 w-3" />
                      {editing
                        ? <select value={draft?.category ?? ""} onChange={e => d("category", e.target.value)}
                            className="bg-transparent text-accent outline-none text-[11px] font-bold uppercase">
                            {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                          </select>
                        : category}
                    </span>
                    {(draft?.featured ?? p.featured) && (
                      <span className="rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-3 py-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        {zh ? "精选" : "Featured"}
                      </span>
                    )}
                    {status !== "published" && (
                      <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-600">{status}</span>
                    )}
                  </div>

                  {/* Title */}
                  {editing ? (
                    <input value={draft?.title ?? ""} onChange={e => d("title", e.target.value)}
                      className="mb-3 w-full bg-transparent text-3xl font-extrabold tracking-tight text-foreground outline-none sm:text-4xl lg:text-5xl"
                      placeholder={zh ? "项目标题" : "Project title"} />
                  ) : (
                    <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">{title}</h1>
                  )}

                  {/* Subtitle: only the first sentence, not the whole Markdown */}
                  {!editing && subtitle && (
                    <p className="mb-8 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">{subtitle}</p>
                  )}

                  {/* Quick action links */}
                  {!editing && links.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-3">
                      {links.map(lk => {
                        const Icon = LINK_ICONS[lk.label] ?? ArrowUpRight;
                        return (
                          <a key={lk.label} href={lk.href} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-5 py-2.5 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-all hover:border-accent/40 hover:bg-accent/5 hover:shadow-md">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {lk.label}
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: zh ? "分类" : "Category", value: category || "-" },
                      { label: zh ? "技术栈" : "Stack", value: stack.slice(0, 3).join(" · ") || "-" },
                      { label: zh ? "状态" : "Status", value: status || "-" },
                      { label: zh ? "更新时间" : "Updated", value: p ? new Date(p.updated_at).toLocaleDateString(dateLocale(locale)) : "-" },
                    ].map(h => (
                      <div key={h.label} className="rounded-xl border border-border/30 bg-muted/20 px-4 py-3">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{h.label}</p>
                        <p className="text-sm font-medium text-foreground">{h.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            {/* ─── Content grid ─── */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
              {/* Left column */}
              <div className="space-y-8">
                {/* Tech stack pills */}
                {stack.length > 0 && !editing && (
                  <div className="flex flex-wrap gap-2">
                    {stack.map(t => (
                      <span key={t} className="rounded-full border border-border/30 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/30 hover:text-accent">{t}</span>
                    ))}
                  </div>
                )}

                {/* Cover edit (admin) */}
                {editing && (
                  <div className="rounded-2xl border border-dashed border-border/50 bg-muted/10 p-5">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{zh ? "封面图" : "Cover Image"}</label>
                    <div className="flex gap-2">
                      <input value={draft?.cover_url ?? ""} onChange={e => d("cover_url", e.target.value)}
                        placeholder="https://... or upload"
                        className="flex-1 rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-accent/50" />
                      <button type="button" disabled={uploadingCover}
                        onClick={() => coverFileRef.current?.click()}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingCover ? (zh ? "上传中..." : "Uploading...") : (zh ? "上传" : "Upload")}
                      </button>
                      <input ref={coverFileRef} type="file" accept="image/*" className="hidden"
                        onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleCoverUpload(f); e.target.value = ""; }} />
                    </div>
                    {cover && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/30 p-2">
                        <img src={cover} alt="" className="h-16 w-24 rounded-lg object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <span className="truncate text-xs text-muted-foreground">{cover}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Main description content — rendered as Markdown */}
                <div className="rounded-[2rem] border border-border/30 bg-card p-8 sm:p-10">
                  {editing ? (
                    <RichEditor
                      key={`proj-desc-${p.slug}`}
                      initialContent={draft?.description ?? ""}
                      token={token ?? undefined}
                      onChange={json => d("description", json)}
                    />
                  ) : desc ? (
                    isBlockNoteJson(desc)
                      ? <RichViewerLazy content={desc} />
                      : <MarkdownRenderer content={desc} />
                  ) : (
                    <p className="text-sm italic text-muted-foreground/50">{zh ? "暂无项目说明" : "No description yet."}</p>
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                {editing ? (
                  <div className="rounded-[2rem] border border-accent/20 bg-card p-6">
                    <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-accent">{zh ? "编辑属性" : "Properties"}</h2>
                    <div className="space-y-4 text-sm">
                      {[
                        { label: "Slug", key: "slug" as const },
                        { label: zh ? "技术栈 (逗号分隔)" : "Tech Stack (comma-separated)", key: "tech_stack" as const },
                        { label: "Repo URL", key: "repo_url" as const },
                        { label: "Demo URL", key: "demo_url" as const },
                        { label: "HuggingFace URL", key: "hf_url" as const },
                      ].map(f => (
                        <div key={f.key}>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{f.label}</p>
                          <input value={String(draft?.[f.key] ?? "")} onChange={e => d(f.key, e.target.value)}
                            className="w-full rounded-xl border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-accent/50" />
                        </div>
                      ))}
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{zh ? "状态" : "Status"}</p>
                        <select value={draft?.status ?? "published"} onChange={e => d("status", e.target.value)}
                          className="w-full rounded-xl border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-accent/50">
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/30">
                        <input type="checkbox" checked={draft?.featured ?? false} onChange={e => d("featured", e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-accent" />
                        <span className="text-xs font-medium">{zh ? "精选项目" : "Featured"}</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Overview */}
                    <div className="rounded-[2rem] border border-border/30 bg-card p-6">
                      <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                        {zh ? "项目信息" : "Overview"}
                      </h2>
                      <div className="space-y-2.5 text-sm">
                        {[
                          { label: zh ? "分类" : "Category", value: p.category },
                          { label: zh ? "状态" : "Status", value: p.status },
                          { label: zh ? "创建时间" : "Created", value: new Date(p.created_at).toLocaleDateString(dateLocale(locale)) },
                          { label: zh ? "更新时间" : "Updated", value: new Date(p.updated_at).toLocaleDateString(dateLocale(locale)) },
                        ].map(item => (
                          <div key={item.label} className="rounded-xl bg-muted/20 px-4 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{item.label}</p>
                            <p className="mt-0.5 font-medium text-foreground">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    {links.length > 0 && (
                      <div className="rounded-[2rem] border border-border/30 bg-card p-6">
                        <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                          {zh ? "快速操作" : "Actions"}
                        </h2>
                        <div className="space-y-2">
                          {links.map(lk => {
                            const Icon = LINK_ICONS[lk.label] ?? ArrowUpRight;
                            return (
                              <a key={lk.label} href={lk.href} target="_blank" rel="noreferrer"
                                className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3 text-sm transition-all hover:border-accent/30 hover:bg-muted/20">
                                <span className="inline-flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  {lk.label}
                                </span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                              </a>
                            );
                          })}
                        </div>
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
