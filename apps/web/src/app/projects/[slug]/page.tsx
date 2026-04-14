"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { EntityDocLayout, type DocActionLink, type DocMetaItem } from "@/components/blocks/entity-doc-layout";
import { useAdminSession } from "@/hooks/use-admin-session";
import { api, type Project } from "@/lib/api";
import { buildProjectDoc } from "@/lib/entity-doc-content";
import { dateLocale, useI18n } from "@/lib/i18n";
import { extractMarkdownToc } from "@/lib/markdown-doc";

type DetailState = "loading" | "ready" | "not_found";
type ProjectDraft = {
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

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { locale } = useI18n();
  const { token, isAdmin } = useAdminSession();
  const [project, setProject] = useState<Project | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) {
      setState("not_found");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState("loading");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await api.projects.get(slug, { cache: "no-store", headers });
      if (cancelled) return;
      if (res.code !== 0 || !res.data) {
        setProject(null);
        setState("not_found");
        return;
      }
      setProject(res.data);
      setState("ready");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  const editing = Boolean(draft);
  const effectiveProject = useMemo<Project | null>(() => {
    if (!project) return null;
    if (!draft) return project;
    return {
      ...project,
      title: draft.title,
      slug: draft.slug,
      category: draft.category,
      description: draft.description,
      tech_stack: draft.tech_stack.split(",").map((item) => item.trim()).filter(Boolean),
      cover_url: draft.cover_url || null,
      repo_url: draft.repo_url || null,
      demo_url: draft.demo_url || null,
      hf_url: draft.hf_url || null,
      featured: draft.featured,
      status: draft.status,
    };
  }, [project, draft]);
  const markdown = useMemo(() => (effectiveProject ? buildProjectDoc(effectiveProject, locale) : ""), [effectiveProject, locale]);
  const currentTitle = draft?.title ?? project?.title ?? "";
  const currentSummary = draft?.description ?? project?.description ?? "";
  const currentCategory = draft?.category ?? project?.category ?? "";
  const currentStatus = draft?.status ?? project?.status ?? "";
  const currentTechStack = (draft?.tech_stack ?? (project?.tech_stack ?? []).join(", "))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const currentCover = draft?.cover_url ?? project?.cover_url ?? "";
  const metaItems = useMemo<DocMetaItem[]>(() => {
    if (!project) return [];
    return [
      { label: locale === "zh" ? "分类" : "Category", value: project.category },
      { label: locale === "zh" ? "状态" : "Status", value: project.status },
      { label: locale === "zh" ? "创建时间" : "Created", value: new Date(project.created_at).toLocaleDateString(dateLocale(locale)) },
      { label: locale === "zh" ? "更新时间" : "Updated", value: new Date(project.updated_at).toLocaleDateString(dateLocale(locale)) },
    ];
  }, [project, locale]);
  const actionLinks = useMemo<DocActionLink[]>(() => {
    if (!project) return [];
    return [
      project.repo_url ? { label: locale === "zh" ? "查看仓库" : "Open Repository", href: project.repo_url } : null,
      project.demo_url ? { label: locale === "zh" ? "查看演示" : "Open Demo", href: project.demo_url } : null,
      project.hf_url ? { label: locale === "zh" ? "查看 Hugging Face" : "Open Hugging Face", href: project.hf_url } : null,
    ].filter(Boolean) as DocActionLink[];
  }, [project, locale]);
  const saveProject = async () => {
    if (!draft || !token || saving || !project) return;
    setSaving(true);
    try {
      const payload: Partial<Project> = {
        title: draft.title.trim() || undefined,
        slug: draft.slug.trim() || undefined,
        category: draft.category.trim() || undefined,
        description: draft.description.trim() || undefined,
        tech_stack: draft.tech_stack.split(",").map((item) => item.trim()).filter(Boolean),
        cover_url: draft.cover_url.trim() || undefined,
        repo_url: draft.repo_url.trim() || undefined,
        demo_url: draft.demo_url.trim() || undefined,
        hf_url: draft.hf_url.trim() || undefined,
        featured: draft.featured,
        status: draft.status.trim() || undefined,
      };
      const res = await api.admin.projects.update(token, project.slug, payload);
      if (res.code === 0 && res.data) {
        const next = res.data;
        setProject(next);
        setDraft(null);
        if (next.slug !== slug) router.replace(`/projects/${next.slug}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <EntityDocLayout
        backHref="/projects"
        backLabel={locale === "zh" ? "返回项目列表" : "Back to projects"}
        typeLabel={locale === "zh" ? "Project" : "Project"}
        icon={<FolderKanban className="h-3.5 w-3.5" />}
        title={currentTitle}
        summary={currentSummary}
        state={state}
        loadingLabel={locale === "zh" ? "正在加载项目文档..." : "Loading project document..."}
        notFoundLabel={locale === "zh" ? "这个项目不存在，或暂未公开。" : "This project does not exist or is not public."}
        markdown={markdown}
        coverUrl={currentCover}
        coverAlt={project?.title ?? "project"}
        badges={[
          ...((draft?.featured ?? project?.featured) ? [locale === "zh" ? "精选项目" : "Featured"] : []),
          ...currentTechStack.slice(0, 4),
        ]}
        highlights={
          project || editing
            ? [
                { label: locale === "zh" ? "分类" : "Category", value: currentCategory || "-" },
                { label: locale === "zh" ? "状态" : "Status", value: currentStatus || "-" },
                { label: locale === "zh" ? "技术栈" : "Stack", value: currentTechStack.slice(0, 3).join(" / ") || "-" },
                { label: locale === "zh" ? "更新时间" : "Updated", value: project ? new Date(project.updated_at).toLocaleDateString(dateLocale(locale)) : "-" },
              ]
            : []
        }
        metaItems={!editing ? metaItems : []}
        actionLinks={actionLinks}
        tocItems={extractMarkdownToc(markdown)}
        titleNode={
          editing ? (
            <input
              value={draft?.title ?? ""}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
              className="w-full rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-4xl font-bold tracking-tight text-foreground outline-none sm:text-5xl lg:text-6xl"
            />
          ) : undefined
        }
        summaryNode={
          editing ? (
            <textarea
              value={draft?.description ?? ""}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
              rows={4}
              className="w-full max-w-3xl rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-lg leading-8 text-muted-foreground outline-none"
            />
          ) : undefined
        }
        coverNode={
          editing ? (
            <div className="space-y-3 rounded-3xl border border-border/50 bg-card p-4">
              <input
                value={draft?.cover_url ?? ""}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, cover_url: e.target.value } : prev))}
                placeholder="Cover URL"
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none"
              />
              {currentCover && <img src={currentCover} alt={currentTitle || "project"} className="rounded-2xl border border-border/50" />}
            </div>
          ) : undefined
        }
        metaNode={
          editing ? (
            <div className="rounded-3xl border border-border/50 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Overview</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Slug</p>
                  <input value={draft?.slug ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, slug: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Category</p>
                  <input value={draft?.category ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, category: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Tech Stack</p>
                  <input value={draft?.tech_stack ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, tech_stack: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Repo URL</p>
                  <input value={draft?.repo_url ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, repo_url: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Demo URL</p>
                  <input value={draft?.demo_url ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, demo_url: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Hugging Face URL</p>
                  <input value={draft?.hf_url ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, hf_url: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</p>
                  <input value={draft?.status ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, status: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" />
                </div>
                <label className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
                  <input type="checkbox" checked={draft?.featured ?? false} onChange={(e) => setDraft((prev) => (prev ? { ...prev, featured: e.target.checked } : prev))} />
                  <span>Featured</span>
                </label>
              </div>
            </div>
          ) : undefined
        }
        adminControls={
          isAdmin && project ? (
            <div className="flex items-center gap-2">
              {!editing ? (
                <button
                  onClick={() =>
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
                    })
                  }
                  className="rounded-full border border-accent/30 bg-background/80 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button onClick={saveProject} disabled={saving} className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setDraft(null)} className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Cancel
                  </button>
                </>
              )}
            </div>
          ) : null
        }
      />
    </>
  );
}
