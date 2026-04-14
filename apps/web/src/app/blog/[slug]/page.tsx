"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookText } from "lucide-react";

import { EntityDocLayout } from "@/components/blocks/entity-doc-layout";
import { useAdminSession } from "@/hooks/use-admin-session";
import { api, type Post } from "@/lib/api";
import { dateLocale, useI18n } from "@/lib/i18n";
import { extractMarkdownToc } from "@/lib/markdown-doc";

type DetailState = "loading" | "ready" | "not_found";
type BlogDraft = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover_url: string;
  tags: string;
  reading_time: string;
  published: boolean;
};

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { token, isAdmin } = useAdminSession();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { t, locale } = useI18n();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [draft, setDraft] = useState<BlogDraft | null>(null);
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
  }, [slug, token]);

  const editing = Boolean(draft);
  const currentTitle = draft?.title ?? post?.title ?? "";
  const currentSummary = draft?.summary ?? post?.summary ?? "";
  const currentContent = draft?.content ?? post?.content ?? "";
  const currentCover = draft?.cover_url ?? post?.cover_url ?? "";
  const currentTags = (draft?.tags ?? (post?.tags ?? []).join(", "))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const currentPublished = draft?.published ?? post?.published ?? false;
  const currentReading = draft?.reading_time ?? String(post?.reading_time ?? "");

  const savePost = async () => {
    if (!draft || !token || saving || !post) return;
    setSaving(true);
    try {
      const payload: Partial<Post> = {
        title: draft.title.trim() || undefined,
        slug: draft.slug.trim() || undefined,
        summary: draft.summary.trim() || undefined,
        content: draft.content,
        cover_url: draft.cover_url.trim() || undefined,
        tags: draft.tags.split(",").map((item) => item.trim()).filter(Boolean),
        reading_time: draft.reading_time ? Number(draft.reading_time) || 0 : undefined,
        published: draft.published,
      };
      const res = await api.admin.posts.update(token, post.slug, payload);
      if (res.code === 0 && res.data) {
        const next = res.data;
        setPost(next);
        setDraft(null);
        if (next.slug !== slug) router.replace(`/blog/${next.slug}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityDocLayout
      backHref="/blog"
      backLabel={t("blog.backToList")}
      typeLabel="Blog"
      icon={<BookText className="h-3.5 w-3.5" />}
      title={currentTitle}
      summary={currentSummary}
      state={state}
      loadingLabel={t("blog.loadingPost")}
      notFoundLabel={t("blog.postNotFound")}
      markdown={currentContent}
      coverUrl={currentCover}
      coverAlt={currentTitle || "blog"}
      badges={[...currentTags.slice(0, 6), ...(!currentPublished && (post || editing) ? [t("blog.draft")] : [])]}
      highlights={
        post || editing
          ? [
              {
                label: locale === "zh" ? "发布时间" : "Published",
                value: post
                  ? new Date(post.created_at).toLocaleDateString(dateLocale(locale), {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "-",
              },
              { label: locale === "zh" ? "阅读时间" : "Reading", value: `${currentReading} ${t("blog.minRead")}`.trim() },
              { label: locale === "zh" ? "浏览量" : "Views", value: `${post?.views ?? 0}` },
              { label: locale === "zh" ? "状态" : "Status", value: currentPublished ? "Published" : t("blog.draft") },
            ]
          : []
      }
      metaItems={
        !editing && post
          ? [
              { label: locale === "zh" ? "发布时间" : "Published", value: new Date(post.created_at).toLocaleDateString(dateLocale(locale)) },
              { label: locale === "zh" ? "阅读时间" : "Reading", value: `${post.reading_time} ${t("blog.minRead")}` },
              { label: locale === "zh" ? "浏览量" : "Views", value: `${post.views}` },
            ]
          : []
      }
      actionLinks={[]}
      tocItems={extractMarkdownToc(currentContent)}
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
            value={draft?.summary ?? ""}
            onChange={(e) => setDraft((prev) => (prev ? { ...prev, summary: e.target.value } : prev))}
            rows={3}
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
            {currentCover && <img src={currentCover} alt={currentTitle || "blog"} className="rounded-2xl border border-border/50" />}
          </div>
        ) : undefined
      }
      contentNode={
        editing ? (
          <textarea
            value={draft?.content ?? ""}
            onChange={(e) => setDraft((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
            rows={26}
            className="min-h-[60vh] w-full rounded-2xl border border-border/60 bg-background px-4 py-4 font-mono text-sm leading-7 outline-none"
          />
        ) : undefined
      }
      metaNode={
        editing ? (
          <div className="rounded-3xl border border-border/50 bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Overview</h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Slug</p>
                <input
                  value={draft?.slug ?? ""}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none"
                />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Tags</p>
                <input
                  value={draft?.tags ?? ""}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, tags: e.target.value } : prev))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none"
                />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Reading Time</p>
                <input
                  value={draft?.reading_time ?? ""}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, reading_time: e.target.value } : prev))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 outline-none"
                />
              </div>
              <label className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
                <input
                  type="checkbox"
                  checked={draft?.published ?? false}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, published: e.target.checked } : prev))}
                />
                <span>Published</span>
              </label>
            </div>
          </div>
        ) : undefined
      }
      adminControls={
        isAdmin && post ? (
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() =>
                  setDraft({
                    title: post.title,
                    slug: post.slug,
                    summary: post.summary ?? "",
                    content: post.content ?? "",
                    cover_url: post.cover_url ?? "",
                    tags: (post.tags ?? []).join(", "),
                    reading_time: String(post.reading_time ?? ""),
                    published: post.published,
                  })
                }
                className="rounded-full border border-accent/30 bg-background/80 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={savePost}
                  disabled={saving}
                  className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        ) : null
      }
    />
  );
}
