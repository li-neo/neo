"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { EntityDocLayout, type DocActionLink, type DocMetaItem } from "@/components/blocks/entity-doc-layout";
import { api, type Project } from "@/lib/api";
import { buildProjectDoc } from "@/lib/entity-doc-content";
import { dateLocale, useI18n } from "@/lib/i18n";
import { extractMarkdownToc } from "@/lib/markdown-doc";

const TOKEN_KEY = "neo-admin-token";

type DetailState = "loading" | "ready" | "not_found";

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { locale } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [state, setState] = useState<DetailState>("loading");

  useEffect(() => {
    if (!slug) {
      setState("not_found");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState("loading");
      const token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
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
  }, [slug]);

  const markdown = useMemo(() => (project ? buildProjectDoc(project, locale) : ""), [project, locale]);
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

  return (
    <EntityDocLayout
      backHref="/projects"
      backLabel={locale === "zh" ? "返回项目列表" : "Back to projects"}
      typeLabel={locale === "zh" ? "Project" : "Project"}
      icon={<FolderKanban className="h-3.5 w-3.5" />}
      title={project?.title ?? ""}
      summary={project?.description}
      state={state}
      loadingLabel={locale === "zh" ? "正在加载项目文档..." : "Loading project document..."}
      notFoundLabel={locale === "zh" ? "这个项目不存在，或暂未公开。" : "This project does not exist or is not public."}
      markdown={markdown}
      coverUrl={project?.cover_url}
      coverAlt={project?.title ?? "project"}
      badges={[
        ...(project?.featured ? [locale === "zh" ? "精选项目" : "Featured"] : []),
        ...(project?.tech_stack ?? []).slice(0, 4),
      ]}
      highlights={
        project
          ? [
              { label: locale === "zh" ? "分类" : "Category", value: project.category },
              { label: locale === "zh" ? "状态" : "Status", value: project.status },
              { label: locale === "zh" ? "技术栈" : "Stack", value: (project.tech_stack ?? []).slice(0, 3).join(" / ") || "-" },
              { label: locale === "zh" ? "更新时间" : "Updated", value: new Date(project.updated_at).toLocaleDateString(dateLocale(locale)) },
            ]
          : []
      }
      metaItems={metaItems}
      actionLinks={actionLinks}
      tocItems={extractMarkdownToc(markdown)}
    />
  );
}
