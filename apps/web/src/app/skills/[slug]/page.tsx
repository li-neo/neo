"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles } from "lucide-react";

import { EntityDocLayout, type DocActionLink, type DocMetaItem } from "@/components/blocks/entity-doc-layout";
import { api, type Skill } from "@/lib/api";
import { buildSkillDoc } from "@/lib/entity-doc-content";
import { dateLocale, useI18n } from "@/lib/i18n";
import { extractMarkdownToc } from "@/lib/markdown-doc";

const TOKEN_KEY = "neo-admin-token";

type DetailState = "loading" | "ready" | "not_found";

export default function SkillDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { locale } = useI18n();
  const [skill, setSkill] = useState<Skill | null>(null);
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
  }, [slug]);

  const markdown = useMemo(() => (skill ? buildSkillDoc(skill, locale) : ""), [skill, locale]);
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

  return (
    <EntityDocLayout
      backHref="/skills"
      backLabel={locale === "zh" ? "返回 Skills 列表" : "Back to skills"}
      typeLabel={locale === "zh" ? "Skill" : "Skill"}
      icon={<Sparkles className="h-3.5 w-3.5" />}
      title={skill?.name ?? ""}
      summary={skill?.description}
      state={state}
      loadingLabel={locale === "zh" ? "正在加载 Skill 文档..." : "Loading skill document..."}
      notFoundLabel={locale === "zh" ? "这个 Skill 不存在，或暂未公开。" : "This skill does not exist or is not public."}
      markdown={markdown}
      coverUrl={null}
      coverAlt={skill?.name ?? "skill"}
      badges={[skill?.category ?? "", skill ? `v${skill.version}` : "", skill?.platform ?? ""].filter(Boolean)}
      highlights={
        skill
          ? [
              { label: locale === "zh" ? "分类" : "Category", value: skill.category },
              { label: locale === "zh" ? "平台" : "Platform", value: skill.platform },
              { label: locale === "zh" ? "版本" : "Version", value: `v${skill.version}` },
              { label: locale === "zh" ? "安装量" : "Installs", value: skill.install_count.toLocaleString() },
            ]
          : []
      }
      metaItems={metaItems}
      actionLinks={actionLinks}
      tocItems={extractMarkdownToc(markdown)}
    />
  );
}
