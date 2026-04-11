"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { api, type Project } from "@/lib/api";
import { useI18n, type TKey } from "@/lib/i18n";

type ProjectCategoryOption =
  | { key: string; labelKey: TKey }
  | { key: string; label: string };

const CATEGORIES: ProjectCategoryOption[] = [
  { key: "", labelKey: "projects.all" as const },
  { key: "llm", label: "LLM" },
  { key: "vla", label: "VLA" },
  { key: "multimodal", label: "Multimodal" },
  { key: "world_model", label: "World Model" },
];

const TOKEN_KEY = "neo-admin-token";
const PROJECT_CREATE_KEYS = ["slug", "title", "description", "category", "tech_stack", "cover_url", "repo_url", "demo_url", "hf_url", "featured", "status"] as const;

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "url_with_upload";
  options?: string[];
}

function projectFields(t: (k: TKey) => string): FieldDef[] {
  return [
    { key: "title", label: t("admin.fTitle"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "category", label: t("admin.fCategory"), type: "select", options: ["llm", "vla", "multimodal", "world_model", "tool"] },
    { key: "description", label: t("admin.fDescription"), type: "textarea" },
    { key: "tech_stack", label: t("admin.fTechStack"), type: "text" },
    { key: "cover_url", label: t("admin.fCoverUrl"), type: "url_with_upload" },
    { key: "repo_url", label: t("admin.fRepoUrl"), type: "text" },
    { key: "demo_url", label: t("admin.fDemoUrl"), type: "text" },
    { key: "hf_url", label: t("admin.fHfUrl"), type: "text" },
    { key: "featured", label: t("admin.fFeatured"), type: "checkbox" },
    { key: "status", label: t("admin.fStatus"), type: "select", options: ["published", "draft", "archived"] },
  ];
}

function pickKeys<T extends Record<string, unknown>>(data: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in data)) continue;
    let value = data[key];
    if (key === "tech_stack" && Array.isArray(value)) {
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
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function ProjectEditSheet({
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

  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-background px-6 py-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-500">
              {t("admin.mode")}
            </p>
            <h3 className="mt-2 text-2xl font-semibold">
              {data.id ? t("admin.edit") : t("admin.create")}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            {t("admin.cancel")}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {projectFields(t).map((field) => {
            const rawValue = data[field.key];
            const stringValue = String(rawValue ?? "");
            const previewUrl = typeof rawValue === "string" ? rawValue.trim() : "";

            return (
              <div key={field.key} className={field.type === "textarea" || field.type === "url_with_upload" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{field.label}</label>

                {field.type === "text" && (
                  <input
                    type="text"
                    value={field.key === "tech_stack" ? (Array.isArray(rawValue) ? (rawValue as string[]).join(", ") : stringValue) : stringValue}
                    onChange={(e) => set(field.key, field.key === "tech_stack" ? e.target.value.split(",").map((item) => item.trim()) : e.target.value)}
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

                {field.type === "select" && (
                  <select
                    value={stringValue}
                    onChange={(e) => set(field.key, e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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
                        <img
                          src={previewUrl}
                          alt="preview"
                          className="h-16 w-24 rounded-md object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
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
            if (file && field) await handleFileUpload(field, file);
            e.target.value = "";
          }}
        />

        <div className="mt-6 flex gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {saving ? t("admin.saving") : t("admin.save")}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border px-5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            {t("admin.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectList({
  projects,
  activeCategory,
}: {
  projects: Project[];
  activeCategory?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const items = useMemo(() => projects, [projects]);

  useEffect(() => {
    const localToken = localStorage.getItem(TOKEN_KEY);
    if (!localToken) return;
    setToken(localToken);
    api.auth.me(localToken).then((res) => {
      setIsAdmin(Boolean(res.data && res.data.role === "admin"));
    }).catch(() => {
      setToken(null);
      setIsAdmin(false);
    });
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
      category: activeCategory || "llm",
      description: "",
      tech_stack: [],
      cover_url: "",
      repo_url: "",
      demo_url: "",
      hf_url: "",
      featured: false,
      status: "published",
    });
  };

  const saveProject = async () => {
    if (!editing || !token || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const payload = pickKeys(editing, [...PROJECT_CREATE_KEYS]);
      const res = isNew
        ? await api.admin.projects.create(token, payload)
        : await api.admin.projects.update(token, String(editing.slug), payload);
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

  const deleteProject = async (slug: string) => {
    if (!token || !window.confirm(t("admin.confirm"))) return;
    const res = await api.admin.projects.delete(token, slug);
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

      {isAdmin && token && editing && (
        <ProjectEditSheet
          token={token}
          data={editing}
          onChange={setEditing}
          onSave={saveProject}
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

      <div className="mb-10 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <a
            key={cat.key}
            href={cat.key ? `/projects?category=${cat.key}` : "/projects"}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              (activeCategory ?? "") === cat.key
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {"labelKey" in cat ? t(cat.labelKey) : cat.label}
          </a>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project, i) => (
          <motion.div
            key={project.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-border hover:shadow-lg hover:shadow-accent/5"
          >
            {isAdmin && (
              <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => setEditing({ ...project })}
                  className="rounded-full border border-white/15 bg-stone-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur"
                >
                  {t("admin.edit")}
                </button>
                <button
                  onClick={() => deleteProject(project.slug)}
                  className="rounded-full border border-red-400/30 bg-red-500/70 px-3 py-1 text-xs font-medium text-white backdrop-blur"
                >
                  {t("admin.delete")}
                </button>
              </div>
            )}
            {project.cover_url && (
              <div className="h-44 w-full overflow-hidden">
                <img
                  src={project.cover_url}
                  alt={project.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {project.category.toUpperCase()}
                </span>
                {project.featured && (
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                    {t("projects.featured")}
                  </span>
                )}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{project.title}</h3>
              <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                {project.description}
              </p>
              {project.tech_stack && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {project.tech_stack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs">
                {project.repo_url && (
                  <a
                    href={project.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    GitHub &nearr;
                  </a>
                )}
                {project.demo_url && (
                  <a
                    href={project.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Demo &nearr;
                  </a>
                )}
                {project.hf_url && (
                  <a
                    href={project.hf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    HuggingFace &nearr;
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("projects.noProjects")}
        </div>
      )}
    </>
  );
}
