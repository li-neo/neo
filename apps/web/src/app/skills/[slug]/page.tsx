"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { EntityDocLayout, type DocActionLink, type DocMetaItem } from "@/components/blocks/entity-doc-layout";
import { useAdminSession } from "@/hooks/use-admin-session";
import { api, type Skill } from "@/lib/api";
import { buildSkillDoc } from "@/lib/entity-doc-content";
import { dateLocale, useI18n } from "@/lib/i18n";
import { extractMarkdownToc } from "@/lib/markdown-doc";

type DetailState = "loading" | "ready" | "not_found";
type SkillDraft = {
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
  const { token, isAdmin } = useAdminSession();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [draft, setDraft] = useState<SkillDraft | null>(null);
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
      const res = await api.skills.get(slug, { cache: "no-store", headers });
      if (cancelled) return;
      if (res.code !== 0 || !res.data) {
        setSkill(null);
        setState("not_found");
        return;
      }
      setSkill(res.data);
      setState("ready");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  const editing = Boolean(draft);
  const effectiveSkill = useMemo<Skill | null>(() => {
    if (!skill) return null;
    if (!draft) return skill;
    return {
      ...skill,
      name: draft.name,
      slug: draft.slug,
      category: draft.category,
      description: draft.description,
      version: draft.version,
      platform: draft.platform,
      install_command: draft.install_command || null,
      source_url: draft.source_url || null,
      status: draft.status,
    };
  }, [skill, draft]);
  const markdown = useMemo(() => (effectiveSkill ? buildSkillDoc(effectiveSkill, locale) : ""), [effectiveSkill, locale]);
  const currentTitle = draft?.name ?? skill?.name ?? "";
  const currentSummary = draft?.description ?? skill?.description ?? "";
  const currentCategory = draft?.category ?? skill?.category ?? "";
  const currentPlatform = draft?.platform ?? skill?.platform ?? "";
  const currentVersion = draft?.version ?? skill?.version ?? "";
  const metaItems = useMemo<DocMetaItem[]>(() => {
    if (!skill) return [];
    return [
      { label: locale === "zh" ? "分类" : "Category", value: skill.category },
      { label: locale === "zh" ? "平台" : "Platform", value: skill.platform },
      { label: locale === "zh" ? "版本" : "Version", value: `v${skill.version}` },
      { label: locale === "zh" ? "安装量" : "Installs", value: skill.install_count.toLocaleString() },
      { label: locale === "zh" ? "更新时间" : "Updated", value: new Date(skill.updated_at).toLocaleDateString(dateLocale(locale)) },
    ];
  }, [skill, locale]);
  const actionLinks = useMemo<DocActionLink[]>(() => {
    if (!skill) return [];
    return [
      skill.source_url ? { label: locale === "zh" ? "查看源码" : "Open Source", href: skill.source_url } : null,
    ].filter(Boolean) as DocActionLink[];
  }, [skill, locale]);
  const saveSkill = async () => {
    if (!draft || !token || saving || !skill) return;
    setSaving(true);
    try {
      const payload: Partial<Skill> = {
        name: draft.name.trim() || undefined,
        slug: draft.slug.trim() || undefined,
        category: draft.category.trim() || undefined,
        description: draft.description.trim() || undefined,
        version: draft.version.trim() || undefined,
        platform: draft.platform.trim() || undefined,
        install_command: draft.install_command.trim() || undefined,
        source_url: draft.source_url.trim() || undefined,
        status: draft.status.trim() || undefined,
      };
      const res = await api.admin.skills.update(token, skill.slug, payload);
      if (res.code === 0 && res.data) {
        const next = res.data;
        setSkill(next);
        setDraft(null);
        if (next.slug !== slug) router.replace(`/skills/${next.slug}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <EntityDocLayout
        backHref="/skills"
        backLabel={locale === "zh" ? "返回 Skills 列表" : "Back to skills"}
        typeLabel={locale === "zh" ? "Skill" : "Skill"}
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title={currentTitle}
        summary={currentSummary}
        state={state}
        loadingLabel={locale === "zh" ? "正在加载 Skill 文档..." : "Loading skill document..."}
        notFoundLabel={locale === "zh" ? "这个 Skill 不存在，或暂未公开。" : "This skill does not exist or is not public."}
        markdown={markdown}
        coverUrl={null}
        coverAlt={currentTitle || "skill"}
        badges={[currentCategory, currentVersion ? `v${currentVersion}` : "", currentPlatform].filter(Boolean)}
        highlights={
          skill || editing
            ? [
                { label: locale === "zh" ? "分类" : "Category", value: currentCategory || "-" },
                { label: locale === "zh" ? "平台" : "Platform", value: currentPlatform || "-" },
                { label: locale === "zh" ? "版本" : "Version", value: currentVersion ? `v${currentVersion}` : "-" },
                { label: locale === "zh" ? "安装量" : "Installs", value: `${skill?.install_count ?? 0}` },
              ]
            : []
        }
        metaItems={!editing ? metaItems : []}
        actionLinks={actionLinks}
        tocItems={extractMarkdownToc(markdown)}
        titleNode={
          editing ? (
            <input
              value={draft?.name ?? ""}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
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
        contentNode={
          editing ? (
            <textarea
              value={draft?.install_command ?? ""}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, install_command: e.target.value } : prev))}
              rows={18}
              className="min-h-[40vh] w-full rounded-2xl border border-border/60 bg-background px-4 py-4 font-mono text-sm leading-7 outline-none"
            />
          ) : undefined
        }
        metaNode={
          editing ? (
            <div className="rounded-3xl border border-border/50 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Overview</h2>
              <div className="space-y-4 text-sm">
                <div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Slug</p><input value={draft?.slug ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, slug: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" /></div>
                <div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Category</p><input value={draft?.category ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, category: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" /></div>
                <div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Version</p><input value={draft?.version ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, version: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" /></div>
                <div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Platform</p><input value={draft?.platform ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, platform: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" /></div>
                <div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Source URL</p><input value={draft?.source_url ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, source_url: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" /></div>
                <div><p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</p><input value={draft?.status ?? ""} onChange={(e) => setDraft((prev) => (prev ? { ...prev, status: e.target.value } : prev))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none" /></div>
              </div>
            </div>
          ) : undefined
        }
        adminControls={
          isAdmin && skill ? (
            <div className="flex items-center gap-2">
              {!editing ? (
                <button
                  onClick={() =>
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
                    })
                  }
                  className="rounded-full border border-accent/30 bg-background/80 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button onClick={saveSkill} disabled={saving} className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
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
