"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BookText } from "lucide-react";

import { EntityDocLayout } from "@/components/blocks/entity-doc-layout";
import { api, type Post } from "@/lib/api";
import { dateLocale, useI18n } from "@/lib/i18n";
import { extractMarkdownToc } from "@/lib/markdown-doc";

const TOKEN_KEY = "neo-admin-token";

type DetailState = "loading" | "ready" | "not_found";

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { t, locale } = useI18n();
  const [post, setPost] = useState<Post | null>(null);
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
      const res = await api.posts.get(slug, { cache: "no-store", headers });

      if (cancelled) return;

      if (res.code !== 0 || !res.data) {
        setPost(null);
        setState("not_found");
        return;
      }

      setPost(res.data);
      setState("ready");
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <EntityDocLayout
      backHref="/blog"
      backLabel={t("blog.backToList")}
      typeLabel={locale === "zh" ? "Blog" : "Blog"}
      icon={<BookText className="h-3.5 w-3.5" />}
      title={post?.title ?? ""}
      summary={post?.summary}
      state={state}
      loadingLabel={t("blog.loadingPost")}
      notFoundLabel={t("blog.postNotFound")}
      markdown={post?.content ?? ""}
      coverUrl={post?.cover_url}
      coverAlt={post?.title ?? "blog"}
      badges={[
        ...(post?.tags ?? []).slice(0, 6),
        ...(!post?.published && post ? [t("blog.draft")] : []),
      ]}
      highlights={
        post
          ? [
              {
                label: locale === "zh" ? "发布时间" : "Published",
                value: new Date(post.created_at).toLocaleDateString(dateLocale(locale), {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
              },
              { label: locale === "zh" ? "阅读时间" : "Reading", value: `${post.reading_time} ${t("blog.minRead")}` },
              { label: locale === "zh" ? "浏览量" : "Views", value: `${post.views}` },
              { label: locale === "zh" ? "状态" : "Status", value: post.published ? "Published" : t("blog.draft") },
            ]
          : []
      }
      metaItems={
        post
          ? [
              { label: locale === "zh" ? "发布时间" : "Published", value: new Date(post.created_at).toLocaleDateString(dateLocale(locale)) },
              { label: locale === "zh" ? "阅读时间" : "Reading", value: `${post.reading_time} ${t("blog.minRead")}` },
              { label: locale === "zh" ? "浏览量" : "Views", value: `${post.views}` },
            ]
          : []
      }
      actionLinks={[]}
      tocItems={extractMarkdownToc(post?.content)}
    />
  );
}
