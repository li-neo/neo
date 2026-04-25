"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookText, Calendar, Clock, Eye, Pencil, Save, Upload, X } from "lucide-react";
import dynamic from "next/dynamic";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MarkdownRenderer } from "@/components/blocks/markdown-renderer";
import { useAdminSession } from "@/hooks/use-admin-session";
import { api, type Post } from "@/lib/api";
import { richTextToPlain } from "@/lib/utils";
import { isRichTextJson } from "@/lib/rich-text";
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

type DetailState = "loading" | "ready" | "not_found";
type Draft = {
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
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { t, locale } = useI18n();
  const zh = locale === "zh";
  const { token, isAdmin } = useAdminSession();
  const [post, setPost] = useState<Post | null>(null);
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
      const res = await api.posts.get(slug, { cache: "no-store", headers });
      if (cancelled) return;
      if (res.code !== 0 || !res.data) { setState("not_found"); return; }
      setPost(res.data);
      setState("ready");
    })();
    return () => { cancelled = true; };
  }, [slug, token]);

  const openEdit = useCallback(() => {
    if (!post) return;
    setDraft({
      title: post.title,
      slug: post.slug,
      summary: post.summary ?? "",
      content: post.content ?? "",
      cover_url: post.cover_url ?? "",
      tags: (post.tags ?? []).join(", "),
      reading_time: String(post.reading_time ?? ""),
      published: post.published,
    });
  }, [post]);

  const save = async () => {
    if (!draft || !token || saving || !post) return;
    setSaving(true);
    try {
      const payload: Partial<Post> = {
        title: draft.title.trim() || undefined,
        slug: draft.slug.trim() || undefined,
        summary: draft.summary.trim() || undefined,
        content: draft.content,
        cover_url: draft.cover_url.trim() || undefined,
        tags: draft.tags.split(",").map(s => s.trim()).filter(Boolean),
        reading_time: draft.reading_time ? Number(draft.reading_time) || 0 : undefined,
        published: draft.published,
      };
      const res = await api.admin.posts.update(token, post.slug, payload);
      if (res.code === 0 && res.data) {
        setPost(res.data);
        setDraft(null);
        if (res.data.slug !== slug) router.replace(`/blog/${res.data.slug}`);
      }
    } finally { setSaving(false); }
  };

  const p = post;
  const title = draft?.title ?? p?.title ?? "";
  const summary = draft?.summary ?? p?.summary ?? "";
  const content = draft?.content ?? p?.content ?? "";
  const cover = draft?.cover_url ?? p?.cover_url ?? "";
  const tags = (draft?.tags ?? (p?.tags ?? []).join(", ")).split(",").map(s => s.trim()).filter(Boolean);
  const published = draft?.published ?? p?.published ?? false;
  const readingTime = draft?.reading_time ?? String(p?.reading_time ?? "");

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
      <main className="mx-auto max-w-5xl px-6 pt-24 pb-20">
        {/* Back + admin */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/blog" className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {t("blog.backToList")}
          </Link>
          {isAdmin && p && !editing && (
            <button onClick={openEdit}
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-medium text-accent transition-all hover:bg-accent/10 hover:shadow-md">
              <Pencil className="h-3.5 w-3.5" />
              {zh ? "编辑文章" : "Edit Post"}
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
            <BookText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-foreground">{t("blog.postNotFound")}</p>
          </div>
        )}

        {state === "ready" && p && (
          <article className="space-y-8">
            {/* Cover image */}
            {cover && !editing && (
              <div className="overflow-hidden rounded-3xl border border-border/40">
                <img src={cover} alt={title} className="h-auto max-h-[480px] w-full object-cover" />
              </div>
            )}
            {editing && (
              <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-4">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">{zh ? "封面图" : "Cover Image"}</label>
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

            {/* Header area */}
            <header>
              {/* Tags */}
              {tags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span key={tag} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{tag}</span>
                  ))}
                  {!published && (
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">{t("blog.draft")}</span>
                  )}
                </div>
              )}

              {/* Title */}
              {editing ? (
                <input value={draft?.title ?? ""} onChange={e => d("title", e.target.value)}
                  className="mb-4 w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none sm:text-4xl lg:text-5xl"
                  placeholder={zh ? "文章标题" : "Post title"} />
              ) : (
                <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">{title}</h1>
              )}

              {/* Meta line */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(p.created_at).toLocaleDateString(dateLocale(locale), { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {readingTime} {t("blog.minRead")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  {p.views.toLocaleString()} {zh ? "次浏览" : "views"}
                </span>
              </div>

              {/* Summary */}
              {editing ? (
                <textarea value={draft?.summary ?? ""} onChange={e => d("summary", e.target.value)}
                  rows={3} placeholder={zh ? "文章摘要..." : "Post summary..."}
                  className="mt-6 w-full rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-lg leading-relaxed text-muted-foreground outline-none focus:border-accent/50" />
              ) : summary ? (
                <p className="mt-6 rounded-2xl border-l-4 border-accent/30 bg-muted/20 px-6 py-4 text-lg leading-relaxed text-muted-foreground italic">
                  {richTextToPlain(summary)}
                </p>
              ) : null}
            </header>

            {/* Divider */}
            <hr className="border-border/30" />

            {/* Main content */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-3xl border border-border/40 bg-card p-6 sm:p-8 lg:p-10">
                {editing ? (
                  <RichEditor
                    key={`blog-content-${p.slug}`}
                    initialContent={draft?.content ?? ""}
                    token={token ?? undefined}
                    onChange={json => d("content", json)}
                  />
                ) : content ? (
                  isRichTextJson(content)
                    ? <RichViewerLazy content={content} />
                    : <MarkdownRenderer content={content} />
                ) : (
                  <p className="text-sm italic text-muted-foreground/50">{zh ? "暂无内容" : "No content yet."}</p>
                )}
              </div>

              {/* Sidebar (editing properties / reading info) */}
              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                {editing ? (
                  <div className="rounded-3xl border border-accent/20 bg-card p-5">
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-accent">{zh ? "文章属性" : "Properties"}</h2>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">Slug</p>
                        <input value={draft?.slug ?? ""} onChange={e => d("slug", e.target.value)}
                          className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-accent/50" />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{zh ? "标签 (逗号分隔)" : "Tags (comma-sep)"}</p>
                        <input value={draft?.tags ?? ""} onChange={e => d("tags", e.target.value)}
                          className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-accent/50" />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{zh ? "阅读时间 (分钟)" : "Reading Time (min)"}</p>
                        <input type="number" value={draft?.reading_time ?? ""} onChange={e => d("reading_time", e.target.value)}
                          className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-accent/50" />
                      </div>
                      <label className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2.5">
                        <input type="checkbox" checked={draft?.published ?? false} onChange={e => d("published", e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-accent" />
                        <span className="text-xs font-medium">{zh ? "已发布" : "Published"}</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-border/40 bg-card p-5">
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {zh ? "文章信息" : "Info"}
                    </h2>
                    <div className="space-y-3 text-sm">
                      {[
                        { label: zh ? "发布时间" : "Published", value: new Date(p.created_at).toLocaleDateString(dateLocale(locale)) },
                        { label: zh ? "阅读时间" : "Reading", value: `${p.reading_time} ${t("blog.minRead")}` },
                        { label: zh ? "浏览量" : "Views", value: `${p.views.toLocaleString()}` },
                        { label: zh ? "状态" : "Status", value: published ? (zh ? "已发布" : "Published") : t("blog.draft") },
                      ].map(item => (
                        <div key={item.label} className="rounded-2xl bg-muted/30 px-4 py-2.5">
                          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
                          <p className="mt-0.5 font-medium text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </article>
        )}
      </main>
      <Footer />
    </>
  );
}
