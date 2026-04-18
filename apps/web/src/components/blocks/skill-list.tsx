"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { api, type Skill } from "@/lib/api";
import { useI18n, type TKey } from "@/lib/i18n";
import { richTextToPlain } from "@/lib/utils";
import { SingleOptionInput } from "@/components/ui/flexible-fields";
import { mergeFlexibleOptions } from "@/lib/flexible-options";
import dynamic from "next/dynamic";

const RichEditor = dynamic(
  () => import("@/components/blocks/rich-editor").then(m => m.RichEditor),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-2xl bg-muted/30" /> },
);

const TOKEN_KEY = "neo-admin-token";
const SKILL_CREATE_KEYS = ["slug", "name", "description", "category", "version", "platform", "install_command", "source_url", "status"] as const;
const DEFAULT_SKILL_CATEGORIES = ["development", "documentation", "devops", "ml", "data"] as const;

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "single_option" | "rich_editor";
  options?: string[];
}

function skillFields(t: (k: TKey) => string, categoryOptions: string[]): FieldDef[] {
  return [
    { key: "name", label: t("admin.fName"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "category", label: t("admin.fCategory"), type: "single_option", options: categoryOptions },
    { key: "description", label: t("admin.fDescription"), type: "rich_editor" },
    { key: "version", label: t("admin.fVersion"), type: "text" },
    { key: "platform", label: t("admin.fPlatform"), type: "select", options: ["openclaw", "mcp", "other"] },
    { key: "install_command", label: t("admin.fInstallCmd"), type: "text" },
    { key: "source_url", label: t("admin.fSourceUrl"), type: "text" },
    { key: "status", label: t("admin.fStatus"), type: "select", options: ["published", "draft", "archived"] },
  ];
}

function pickKeys<T extends Record<string, unknown>>(data: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in data)) continue;
    const value = data[key] === "" ? null : data[key];
    out[key] = value;
  }
  return out as Partial<T>;
}

function SkillEditSheet({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  categoryOptions,
}: {
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  categoryOptions: string[];
}) {
  const { t } = useI18n();
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-background px-6 py-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-orange-500">{t("admin.mode")}</p>
            <h3 className="mt-2 text-2xl font-semibold">{data.id ? t("admin.edit") : t("admin.create")}</h3>
          </div>
          <button onClick={onCancel} className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted">
            {t("admin.cancel")}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {skillFields(t, categoryOptions).map((field) => {
            const stringValue = String(data[field.key] ?? "");
            return (
              <div key={field.key} className={field.type === "textarea" || field.type === "rich_editor" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{field.label}</label>
                {field.type === "text" && (
                  <input
                    type="text"
                    value={stringValue}
                    onChange={(e) => set(field.key, e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                )}
                {field.type === "single_option" && (
                  <SingleOptionInput
                    value={stringValue}
                    options={field.options ?? []}
                    onChange={(next) => set(field.key, next)}
                    placeholder={field.label}
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
                    token={typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) ?? undefined : undefined}
                    onChange={(json) => set(field.key, json)}
                  />
                )}
                {field.type === "select" && (
                  <select
                    value={stringValue}
                    onChange={(e) => set(field.key, e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {field.options?.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onSave} disabled={saving} className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">
            {saving ? t("admin.saving") : t("admin.save")}
          </button>
          <button onClick={onCancel} className="rounded-lg border px-5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
            {t("admin.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillList({ skills }: { skills: Skill[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<Skill[]>(skills);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const visibleSkills = useMemo(() => items, [items]);
  const categoryOptions = useMemo(
    () => mergeFlexibleOptions(DEFAULT_SKILL_CATEGORIES, items.map((item) => item.category)),
    [items],
  );

  useEffect(() => {
    setItems(skills);
  }, [skills]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setToken(token);
    api.auth.me(token).then((res) => {
      const admin = Boolean(res.data && res.data.role === "admin");
      setIsAdmin(admin);
      if (!admin) return;
      return api.skills.list("include_all=true&page_size=100", {
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
      name: "",
      slug: "",
      category: "development",
      description: "",
      version: "0.1.0",
      platform: "openclaw",
      install_command: "",
      source_url: "",
      status: "published",
    });
  };

  const saveSkill = async () => {
    if (!editing || !token || saving) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const payload = pickKeys(editing, [...SKILL_CREATE_KEYS]);
      const res = isNew
        ? await api.admin.skills.create(token, payload)
        : await api.admin.skills.update(token, String(editing.slug), payload);
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

  const deleteSkill = async (slug: string) => {
    if (!token || !window.confirm(t("admin.confirm"))) return;
    const res = await api.admin.skills.delete(token, slug);
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

      {isAdmin && editing && (
        <SkillEditSheet
          data={editing}
          onChange={setEditing}
          onSave={saveSkill}
          onCancel={() => setEditing(null)}
          saving={saving}
          categoryOptions={categoryOptions}
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {visibleSkills.map((skill, i) => (
        <motion.div
          key={skill.slug}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          className="group relative rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
        >
          {isAdmin && (
            <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setEditing({ ...skill })}
                className="rounded-full border border-white/15 bg-stone-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur"
              >
                {t("admin.edit")}
              </button>
              <button
                onClick={() => deleteSkill(skill.slug)}
                className="rounded-full border border-red-400/30 bg-red-500/70 px-3 py-1 text-xs font-medium text-white backdrop-blur"
              >
                {t("admin.delete")}
              </button>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                {skill.category}
              </span>
              {skill.status !== "published" && (
                <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  skill.status === "draft"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-stone-500/10 text-stone-400"
                }`}>
                  {skill.status}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              v{skill.version}
            </span>
          </div>

          <Link href={`/skills/${skill.slug}`} className="block">
            <h3 className="mb-2 text-lg font-semibold transition-colors group-hover:text-accent">
              {skill.name}
            </h3>
            <p className="mb-5 line-clamp-3 text-sm text-muted-foreground">
              {richTextToPlain(skill.description)}
            </p>
          </Link>

          {skill.install_command && (
            <div className="mb-4 rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              $ {skill.install_command}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              <span>{skill.platform}</span>
            </div>
            <span>{skill.install_count.toLocaleString()} {t("skills.installs")}</span>
          </div>

          {skill.source_url && (
            <a
              href={skill.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("skills.viewSource")} &nearr;
            </a>
          )}
          <div className="mt-3">
            <Link href={`/skills/${skill.slug}`} className="text-xs text-accent transition-colors hover:text-foreground">
              {t("skills.browseAll")} &rarr;
            </Link>
          </div>
        </motion.div>
      ))}

      {visibleSkills.length === 0 && (
        <div className="col-span-full rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("skills.noSkills")}
        </div>
      )}
      </div>
    </>
  );
}
