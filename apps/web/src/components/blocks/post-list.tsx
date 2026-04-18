"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { api, type Post } from "@/lib/api";
import { useI18n, dateLocale, type TKey } from "@/lib/i18n";
import { MarkdownRenderer } from "@/components/blocks/markdown-renderer";
import { embedPostSourceMeta, parsePostSourceMeta, sourceLabel } from "@/lib/post-content";
import dynamic from "next/dynamic";

const RichEditor = dynamic(
  () => import("@/components/blocks/rich-editor").then(m => m.RichEditor),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted/30" /> },
);

const RichViewerLazy = dynamic(
  () => import("@/components/blocks/rich-editor").then(m => m.RichViewer),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl bg-muted/30" /> },
);

function isBlockNoteJson(content: string | null | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed.startsWith("[")) return false;
  try { const p = JSON.parse(trimmed); return Array.isArray(p); } catch { return false; }
}

const TOKEN_KEY = "neo-admin-token";
const POST_CREATE_KEYS = ["slug", "title", "summary", "content", "cover_url", "tags", "reading_time", "published"] as const;

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "url_with_upload" | "rich_editor";
}

function postFields(t: (k: TKey) => string): FieldDef[] {
  return [
    { key: "title", label: t("admin.fTitle"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "summary", label: t("admin.fSummary"), type: "textarea" },
    { key: "content", label: t("admin.fContent"), type: "rich_editor" },
    { key: "cover_url", label: t("admin.fCoverUrl"), type: "url_with_upload" },
    { key: "tags", label: t("admin.fTags"), type: "text" },
    { key: "reading_time", label: t("admin.fReadingTime"), type: "text" },
    { key: "published", label: t("admin.fPublished"), type: "checkbox" },
  ];
}

function pickKeys<T extends Record<string, unknown>>(data: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in data)) continue;
    let value = data[key];
    if (key === "tags" && Array.isArray(value)) {
      value = (value as string[]).filter((item) => item.length > 0);
      if ((value as string[]).length === 0) value = null;
    }
    if (value === "") value = null;
    out[key] = value;
  }
  return out as Partial<T>;
}

function compressImage(file: File, maxW = 1600, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w <= maxW) {
        resolve(file);
        return;
      }
      const ratio = maxW / w;
      w = maxW;
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) {
          resolve(file);
          return;
        }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
      }, "image/webp", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function PostEditSheet({
  token,
  data,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  token: string;
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });

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
    onChange({
      ...data,
      title: data.title || draft.title,
      slug: data.slug || draft.slug,
      summary: data.summary || draft.summary,
      content: contentWithMeta,
      tags: draft.tags,
      cover_url: data.cover_url || draft.cover_url,
      published: typeof data.published === "boolean" ? data.published : draft.published,
      reading_time: draft.reading_time,
    });
  };

  const handleFileUpload = async (key: string, file: File) => {
    setUploadingField(key);
    const compressed = await compressImage(file);
    const res = await api.admin.upload(token, compressed);
    if (res.data) {
      const url = res.data.url.startsWith("http")
        ? res.data.url
        : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${res.data.url}`;
      set(key, url);
    }
    setUploadingField(null);
  };

  const importDoc = async (file: File) => {
    setUploadingField("post-import");
    const res = await api.admin.posts.importFile(token, file);
    if (res.data) applyImportedDraft(res.data);
    setUploadingField(null);
  };

  const importRemoteDoc = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setUploadingField("post-import");
    const res = await api.admin.posts.importUrl(token, url);
    if (res.data) {
      applyImportedDraft(res.data);
      setImportUrl("");
    }
    setUploadingField(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-background px-6 py-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-500">{t("admin.mode")}</p>
            <h3 className="mt-2 text-2xl font-semibold">{data.id ? t("admin.edit") : t("admin.create")}</h3>
          </div>
          <button onClick={onCancel} className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted">
            {t("admin.cancel")}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              fileRef.current?.setAttribute("data-field", "__import__");
              fileRef.current?.click();
            }}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
            disabled={uploadingField === "post-import"}
          >
            {uploadingField === "post-import" ? t("admin.uploading") : t("admin.uploadDoc")}
          </button>
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
          >
            {t("admin.importUrl")}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {postFields(t).map((field) => {
            const rawValue = data[field.key];
            const stringValue = field.key === "tags" && Array.isArray(rawValue) ? (rawValue as string[]).join(", ") : String(rawValue ?? "");
            const previewUrl = typeof rawValue === "string" ? rawValue.trim() : "";
            return (
              <div key={field.key} className={field.type === "textarea" || field.type === "url_with_upload" || field.type === "rich_editor" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{field.label}</label>
                {field.type === "text" && (
                  <input
                    type="text"
                    value={stringValue}
                    onChange={(e) => set(field.key, field.key === "tags" ? e.target.value.split(",").map((item) => item.trim()) : e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                )}
                {field.type === "textarea" && (
                  <textarea
                    value={stringValue}
                    onChange={(e) => set(field.key, e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                )}
                {field.type === "rich_editor" && (
                  <RichEditor
                    key={`${data.id ?? "new"}-${field.key}`}
                    initialContent={stringValue}
                    token={token}
                    onChange={(json) => set(field.key, json)}
                  />
                )}
                {field.type === "checkbox" && (
                  <input
                    type="checkbox"
                    checked={Boolean(rawValue)}
                    onChange={(e) => set(field.key, e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                )}
                {field.type === "url_with_upload" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={stringValue}
                        onChange={(e) => set(field.key, e.target.value)}
                        placeholder="https://... or upload"
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={uploadingField === field.key}
                        onClick={() => {
                          fileRef.current?.setAttribute("data-field", field.key);
                          fileRef.current?.click();
                        }}
                        className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
                      >
                        {uploadingField === field.key ? t("admin.uploading") : t("admin.upload")}
                      </button>
                    </div>
                    {previewUrl.length > 0 && (
                      <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
                        <img src={previewUrl} alt="preview" className="h-16 w-24 rounded-md object-cover" />
                        <span className="truncate text-xs text-muted-foreground">{previewUrl}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const field = fileRef.current?.getAttribute("data-field");
            if (file && field === "__import__") await importDoc(file);
            else if (file && field) await handleFileUpload(field, file);
            e.target.value = "";
          }}
        />

        <div className="mt-6 flex gap-3">
          <button onClick={onSave} disabled={saving} className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">
            {saving ? t("admin.saving") : t("admin.save")}
          </button>
          <button onClick={onCancel} className="rounded-lg border px-5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
            {t("admin.cancel")}
          </button>
        </div>

        {typeof data.content === "string" && data.content.trim().length > 0 && (
          <div className="mt-6 rounded-2xl border border-border/50 bg-card p-6">
            {isBlockNoteJson(data.content as string)
              ? <RichViewerLazy content={data.content as string} />
              : <MarkdownRenderer content={data.content as string} />}
          </div>
        )}
      </div>
    </div>
  );
}

export function PostList({ posts }: { posts: Post[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<Post[]>(posts);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
    setEditing({
      title: "",
      slug: "",
      summary: "",
      content: "",
      cover_url: "",
      tags: [],
      reading_time: 5,
      published: true,
    });
  };

  const savePost = async () => {
    if (!editing || !token || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const payload = pickKeys(editing, [...POST_CREATE_KEYS]);
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
        <PostEditSheet
          token={token}
          data={editing}
          onChange={setEditing}
          onSave={savePost}
          onCancel={() => setEditing(null)}
          saving={saving}
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
                {post.summary}
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
