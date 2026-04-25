"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { api, type Post } from "@/lib/api";
import { useI18n, dateLocale } from "@/lib/i18n";
import { MarkdownRenderer } from "@/components/blocks/markdown-renderer";
import { embedPostSourceMeta, parsePostSourceMeta, sourceLabel } from "@/lib/post-content";
import dynamic from "next/dynamic";
import { DetailEditSheet } from "@/components/blocks/detail-edit-sheet";
import { isRichTextJson, richTextToPlain } from "@/lib/rich-text";
import { TOKEN_KEY, createEmptyPost, pickPostPayload, postFields } from "@/lib/entity-editor-config";

const RichViewerLazy = dynamic(
  () => import("@/components/blocks/rich-editor").then((m) => m.RichViewer),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl bg-muted/30" /> },
);

export function PostList({ posts }: { posts: Post[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<Post[]>(posts);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const visiblePosts = useMemo(() => items, [items]);

  useEffect(() => {
    setItems(posts);
  }, [posts]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setToken(token);
    api.auth.me(token).then((res) => {
      const admin = Boolean(res.data && res.data.role === "admin");
      setIsAdmin(admin);
      if (!admin) return;
      return api.posts.list("include_all=true&page_size=100", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      }).then((allRes) => {
        if (allRes.data) setItems(allRes.data);
      });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openCreate = () => {
    setEditing(createEmptyPost());
  };

  const applyImportedDraft = (draft: {
    title: string;
    slug: string;
    summary: string;
    content: string;
    tags: string[];
    cover_url: string | null;
    published: boolean;
    reading_time: number;
    source_type?: string;
    source_url?: string | null;
  }) => {
    const contentWithMeta = embedPostSourceMeta(draft.content, {
      sourceType: draft.source_type ?? null,
      sourceUrl: draft.source_url ?? null,
    });

    setEditing((prev) => ({
      ...(prev ?? createEmptyPost()),
      title: prev?.title || draft.title,
      slug: prev?.slug || draft.slug,
      summary: prev?.summary || draft.summary,
      content: contentWithMeta,
      tags: draft.tags,
      cover_url: prev?.cover_url || draft.cover_url,
      published: typeof prev?.published === "boolean" ? prev.published : draft.published,
      reading_time: draft.reading_time,
    }));
  };

  const importDoc = async (file: File) => {
    if (!token) return;
    setImporting(true);
    try {
      const res = await api.admin.posts.importFile(token, file);
      if (res.data) applyImportedDraft(res.data);
    } finally {
      setImporting(false);
    }
  };

  const importRemoteDoc = async () => {
    if (!token) return;
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    try {
      const res = await api.admin.posts.importUrl(token, url);
      if (res.data) {
        applyImportedDraft(res.data);
        setImportUrl("");
      }
    } finally {
      setImporting(false);
    }
  };

  const savePost = async () => {
    if (!editing || !token || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const payload = pickPostPayload(editing);
      const res = isNew
        ? await api.admin.posts.create(token, payload)
        : await api.admin.posts.update(token, String(editing.slug), payload);
      if (res.code === 0) {
        setToast(t("admin.saved"));
        setEditing(null);
        router.refresh();
      } else {
        setToast(`${t("admin.saveFailed")}: ${res.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (slug: string) => {
    if (!token || !window.confirm(t("admin.confirm"))) return;
    const res = await api.admin.posts.delete(token, slug);
    if (res.code === 0) {
      setToast(t("admin.deleted"));
      router.refresh();
    } else {
      setToast(t("admin.deleteFailed"));
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed top-20 right-6 z-50 rounded-xl border border-green-500/20 bg-green-500/10 px-5 py-3 text-sm font-medium text-green-600 shadow-lg backdrop-blur-sm">
          {toast}
        </div>
      )}

      {isAdmin && editing && token && (
        <DetailEditSheet
          open
          title={editing.id ? t("admin.edit") : t("admin.create")}
          token={token}
          fields={postFields(t)}
          data={editing}
          onChange={setEditing}
          onSave={savePost}
          onCancel={() => setEditing(null)}
          saving={saving}
          modeLabel={t("admin.mode")}
          closeLabel={t("admin.cancel")}
          saveLabel={t("admin.save")}
          savingLabel={t("admin.saving")}
          cancelLabel={t("admin.cancel")}
          beforeFields={
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
                disabled={importing}
              >
                {importing ? t("admin.uploading") : t("admin.uploadDoc")}
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".md,.markdown,.txt,.pdf,.html"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await importDoc(file);
                  e.target.value = "";
                }}
              />
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder={t("admin.importPlaceholder")}
                className="min-w-[260px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={importRemoteDoc}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                disabled={importing}
              >
                {t("admin.importUrl")}
              </button>
            </div>
          }
          afterFields={
            typeof editing.content === "string" && editing.content.trim().length > 0 ? (
              <div className="mt-6 rounded-2xl border border-border/50 bg-card p-6">
                {isRichTextJson(editing.content)
                  ? <RichViewerLazy content={editing.content} />
                  : <MarkdownRenderer content={editing.content} />}
              </div>
            ) : null
          }
        />
      )}

      {isAdmin && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-orange-400/20 bg-orange-500/5 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-500">{t("admin.mode")}</p>
            <p className="text-sm text-muted-foreground">{t("admin.managing")}</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-400"
          >
            {t("admin.create")}
          </button>
        </div>
      )}

      <div className="space-y-8">
        {visiblePosts.map((post, i) => {
          const source = parsePostSourceMeta(post.content);
          const sourceText = sourceLabel(source.sourceType);
          return (
        <motion.article
          key={post.slug}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="group relative"
        >
          {isAdmin && (
            <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setEditing({ ...post })}
                className="rounded-full border border-white/15 bg-stone-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur"
              >
                {t("admin.edit")}
              </button>
              <button
                onClick={() => deletePost(post.slug)}
                className="rounded-full border border-red-400/30 bg-red-500/70 px-3 py-1 text-xs font-medium text-white backdrop-blur"
              >
                {t("admin.delete")}
              </button>
            </div>
          )}
          <a
            href={`/blog/${post.slug}`}
            className="flex gap-6 rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-border hover:shadow-lg hover:shadow-accent/5"
          >
            {post.cover_url && (
              <div className="hidden sm:block h-32 w-48 flex-shrink-0 overflow-hidden rounded-xl">
                <img
                  src={post.cover_url}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                <time>
                  {new Date(post.created_at).toLocaleDateString(dateLocale(locale), {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                {!post.published && (
                  <>
                    <span>&middot;</span>
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-500">
                      draft
                    </span>
                  </>
                )}
                {sourceText && (
                  <>
                    <span>&middot;</span>
                    <span className="rounded-md bg-accent/10 px-2 py-0.5 text-accent">
                      {sourceText}
                    </span>
                  </>
                )}
                <span>&middot;</span>
                <span>{post.reading_time} {t("blog.minRead")}</span>
                <span>&middot;</span>
                <span>{post.views} {t("blog.views")}</span>
              </div>
              <h2 className="mb-2 text-xl font-semibold group-hover:text-accent transition-colors">
                {post.title}
              </h2>
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                {richTextToPlain(post.summary)}
              </p>
              {post.tags && (
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </a>
        </motion.article>
          );
        })}

      {visiblePosts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("blog.noPosts")}
        </div>
      )}
      </div>
    </>
  );
}
