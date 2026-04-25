import type { Post, Project, Skill } from "@/lib/api";
import type { TKey } from "@/lib/i18n";

export type EntityFieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "checkbox" | "url_with_upload" | "single_option" | "multi_option" | "rich_editor";
  options?: string[];
  rows?: number;
  wide?: boolean;
};

export const TOKEN_KEY = "neo-admin-token";

export const PROJECT_CREATE_KEYS = ["slug", "title", "description", "category", "tech_stack", "cover_url", "repo_url", "demo_url", "hf_url", "featured", "status"] as const;
export const SKILL_CREATE_KEYS = ["slug", "name", "description", "category", "version", "platform", "install_command", "source_url", "status"] as const;
export const POST_CREATE_KEYS = ["slug", "title", "summary", "content", "cover_url", "tags", "reading_time", "published"] as const;

export const DEFAULT_PROJECT_CATEGORIES = ["llm", "vla", "multimodal", "world_model", "tool"] as const;
export const DEFAULT_SKILL_CATEGORIES = ["development", "documentation", "devops", "ml", "data"] as const;
export const PROJECT_STATUS_OPTIONS = ["published", "draft", "archived"] as const;
export const SKILL_PLATFORM_OPTIONS = ["openclaw", "mcp", "other"] as const;

function pickEntityKeys<T extends Record<string, unknown>>(data: T, keys: readonly string[], arrayKeys: readonly string[] = []): Partial<T> {
  const out: Record<string, unknown> = {};

  for (const key of keys) {
    if (!(key in data)) continue;

    let value = data[key];

    if (arrayKeys.includes(key)) {
      if (Array.isArray(value)) {
        value = (value as string[]).map((item) => item.trim()).filter(Boolean);
      } else if (typeof value === "string") {
        value = value.split(",").map((item) => item.trim()).filter(Boolean);
      }

      if (Array.isArray(value) && value.length === 0) value = null;
    }

    if (value === "") value = null;
    out[key] = value;
  }

  return out as Partial<T>;
}

export function projectFields(t: (k: TKey) => string, categoryOptions: string[], techStackOptions: string[]): EntityFieldDef[] {
  return [
    { key: "title", label: t("admin.fTitle"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "category", label: t("admin.fCategory"), type: "single_option", options: categoryOptions },
    { key: "description", label: t("admin.fDescription"), type: "rich_editor", wide: true },
    { key: "tech_stack", label: t("admin.fTechStack"), type: "multi_option", options: techStackOptions },
    { key: "cover_url", label: t("admin.fCoverUrl"), type: "url_with_upload", wide: true },
    { key: "repo_url", label: t("admin.fRepoUrl"), type: "text" },
    { key: "demo_url", label: t("admin.fDemoUrl"), type: "text" },
    { key: "hf_url", label: t("admin.fHfUrl"), type: "text" },
    { key: "featured", label: t("admin.fFeatured"), type: "checkbox" },
    { key: "status", label: t("admin.fStatus"), type: "select", options: [...PROJECT_STATUS_OPTIONS] },
  ];
}

export function skillFields(t: (k: TKey) => string, categoryOptions: string[]): EntityFieldDef[] {
  return [
    { key: "name", label: t("admin.fName"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "category", label: t("admin.fCategory"), type: "single_option", options: categoryOptions },
    { key: "description", label: t("admin.fDescription"), type: "rich_editor", wide: true },
    { key: "version", label: t("admin.fVersion"), type: "text" },
    { key: "platform", label: t("admin.fPlatform"), type: "select", options: [...SKILL_PLATFORM_OPTIONS] },
    { key: "install_command", label: t("admin.fInstallCmd"), type: "text" },
    { key: "source_url", label: t("admin.fSourceUrl"), type: "text" },
    { key: "status", label: t("admin.fStatus"), type: "select", options: [...PROJECT_STATUS_OPTIONS] },
  ];
}

export function postFields(t: (k: TKey) => string): EntityFieldDef[] {
  return [
    { key: "title", label: t("admin.fTitle"), type: "text" },
    { key: "slug", label: t("admin.fSlug"), type: "text" },
    { key: "summary", label: t("admin.fSummary"), type: "textarea", rows: 4, wide: true },
    { key: "content", label: t("admin.fContent"), type: "rich_editor", wide: true },
    { key: "cover_url", label: t("admin.fCoverUrl"), type: "url_with_upload", wide: true },
    { key: "tags", label: t("admin.fTags"), type: "text" },
    { key: "reading_time", label: t("admin.fReadingTime"), type: "number" },
    { key: "published", label: t("admin.fPublished"), type: "checkbox" },
  ];
}

export function createEmptyProject(defaultCategory = "llm"): Partial<Project> {
  return {
    title: "",
    slug: "",
    category: defaultCategory,
    description: "",
    tech_stack: [],
    cover_url: "",
    repo_url: "",
    demo_url: "",
    hf_url: "",
    featured: false,
    status: "published",
  };
}

export function createEmptySkill(): Partial<Skill> {
  return {
    name: "",
    slug: "",
    category: "development",
    description: "",
    version: "0.1.0",
    platform: "openclaw",
    install_command: "",
    source_url: "",
    status: "published",
  };
}

export function createEmptyPost(): Partial<Post> {
  return {
    title: "",
    slug: "",
    summary: "",
    content: "",
    cover_url: "",
    tags: [],
    reading_time: 5,
    published: true,
  };
}

export function pickProjectPayload(data: Record<string, unknown>): Partial<Project> {
  return pickEntityKeys(data, PROJECT_CREATE_KEYS, ["tech_stack"]) as Partial<Project>;
}

export function pickSkillPayload(data: Record<string, unknown>): Partial<Skill> {
  return pickEntityKeys(data, SKILL_CREATE_KEYS) as Partial<Skill>;
}

export function pickPostPayload(data: Record<string, unknown>): Partial<Post> {
  return pickEntityKeys(data, POST_CREATE_KEYS, ["tags"]) as Partial<Post>;
}
