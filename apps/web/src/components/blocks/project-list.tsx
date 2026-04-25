"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { api, type Project } from "@/lib/api";
import { useI18n, type TKey } from "@/lib/i18n";
import { richTextToPlain } from "@/lib/utils";
import { ensureStringArray, mergeFlexibleOptions } from "@/lib/flexible-options";
import { DetailEditSheet } from "@/components/blocks/detail-edit-sheet";
import { TOKEN_KEY, createEmptyProject, pickProjectPayload, projectFields } from "@/lib/entity-editor-config";

type ProjectCategoryOption =
  | { key: string; labelKey: TKey }
  | { key: string; label: string };

const DEFAULT_CATEGORIES: ProjectCategoryOption[] = [
  { key: "", labelKey: "projects.all" as const },
  { key: "llm", label: "LLM" },
  { key: "vla", label: "VLA" },
  { key: "multimodal", label: "Multimodal" },
  { key: "world_model", label: "World Model" },
  { key: "tool", label: "Tool" },
];

export function ProjectList({
  projects,
  activeCategory,
  categoryOptions: initialCategoryOptions,
}: {
  projects: Project[];
  activeCategory?: string;
  categoryOptions?: string[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [items, setItems] = useState<Project[]>(projects);
  const visibleProjects = useMemo(() => items, [items]);
  const categoryOptions = useMemo(
    () => mergeFlexibleOptions(
      DEFAULT_CATEGORIES.map((item) => item.key).filter(Boolean),
      initialCategoryOptions ?? [],
      items.map((item) => item.category),
      activeCategory ? [activeCategory] : [],
    ),
    [activeCategory, initialCategoryOptions, items],
  );
  const techStackOptions = useMemo(
    () => mergeFlexibleOptions(
      ...items.map((item) => item.tech_stack ?? []),
      editing && "tech_stack" in editing ? ensureStringArray(editing.tech_stack) : [],
    ),
    [editing, items],
  );
  const categoryTabs = useMemo<ProjectCategoryOption[]>(
    () => [
      DEFAULT_CATEGORIES[0],
      ...categoryOptions.map((option) => {
        const preset = DEFAULT_CATEGORIES.find((item) => item.key === option);
        return preset ?? { key: option, label: option };
      }),
    ],
    [categoryOptions],
  );

  useEffect(() => {
    setItems(projects);
  }, [projects]);

  useEffect(() => {
    const localToken = localStorage.getItem(TOKEN_KEY);
    if (!localToken) return;
    setToken(localToken);
    api.auth.me(localToken).then((res) => {
      const admin = Boolean(res.data && res.data.role === "admin");
      setIsAdmin(admin);
      if (!admin) return;
      const categoryParam = activeCategory ? `category=${activeCategory}&` : "";
      return api.projects.list(`${categoryParam}include_all=true&page_size=100`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${localToken}` },
      }).then((allRes) => {
        if (allRes.data) setItems(allRes.data);
      });
    }).catch(() => {
      setToken(null);
      setIsAdmin(false);
    });
  }, [activeCategory]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openCreate = () => {
    setEditing(createEmptyProject(activeCategory || "llm"));
  };

  const saveProject = async () => {
    if (!editing || !token || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const payload = pickProjectPayload(editing);
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
        <DetailEditSheet
          open
          title={editing.id ? t("admin.edit") : t("admin.create")}
          token={token}
          fields={projectFields(t, categoryOptions, techStackOptions)}
          data={editing}
          onChange={setEditing}
          onSave={saveProject}
          onCancel={() => setEditing(null)}
          saving={saving}
          modeLabel={t("admin.mode")}
          closeLabel={t("admin.cancel")}
          saveLabel={t("admin.save")}
          savingLabel={t("admin.saving")}
          cancelLabel={t("admin.cancel")}
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
        {categoryTabs.map((cat) => (
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
        {visibleProjects.map((project, i) => (
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
                {project.status !== "published" && (
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    project.status === "draft"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-stone-500/10 text-stone-400"
                  }`}>
                    {project.status}
                  </span>
                )}
                {project.featured && (
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                    {t("projects.featured")}
                  </span>
                )}
              </div>
              <Link href={`/projects/${project.slug}`} className="block">
                <h3 className="mb-2 text-lg font-semibold transition-colors group-hover:text-accent">{project.title}</h3>
                <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                  {richTextToPlain(project.description)}
                </p>
              </Link>
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
                <Link href={`/projects/${project.slug}`} className="text-accent transition-colors hover:text-foreground">
                  {t("projects.viewAll")} &rarr;
                </Link>
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

      {visibleProjects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("projects.noProjects")}
        </div>
      )}
    </>
  );
}
