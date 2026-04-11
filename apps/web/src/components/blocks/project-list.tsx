"use client";

import { motion } from "framer-motion";
import type { Project } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const CATEGORIES = [
  { key: "", labelKey: "projects.all" as const },
  { key: "llm", label: "LLM" },
  { key: "vla", label: "VLA" },
  { key: "multimodal", label: "Multimodal" },
  { key: "world_model", label: "World Model" },
];

export function ProjectList({
  projects,
  activeCategory,
}: {
  projects: Project[];
  activeCategory?: string;
}) {
  const { t } = useI18n();

  return (
    <>
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
        {projects.map((project, i) => (
          <motion.div
            key={project.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="group overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-border hover:shadow-lg hover:shadow-accent/5"
          >
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
