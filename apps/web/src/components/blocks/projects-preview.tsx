"use client";

import { motion } from "framer-motion";
import type { Project } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  llm: { label: "LLM", color: "from-blue-500 to-cyan-500" },
  vla: { label: "VLA", color: "from-green-500 to-emerald-500" },
  multimodal: { label: "Multimodal", color: "from-purple-500 to-pink-500" },
  world_model: { label: "World Model", color: "from-orange-500 to-amber-500" },
  tool: { label: "Tool", color: "from-gray-500 to-zinc-400" },
};

export function ProjectsPreview({ projects }: { projects: Project[] }) {
  const { t } = useI18n();

  return (
    <section className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("projects.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("projects.subtitle")}
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {projects.map((project, i) => {
            const style = CATEGORY_STYLES[project.category] ?? {
              label: project.category,
              color: "from-gray-500 to-zinc-400",
            };
            return (
              <motion.a
                key={project.slug}
                href={`/projects?category=${project.category}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-border hover:shadow-lg hover:shadow-accent/5"
              >
                {project.cover_url && (
                  <div className="h-40 w-full overflow-hidden">
                    <img
                      src={project.cover_url}
                      alt={project.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                  </div>
                )}
                <div className="relative z-10 p-6">
                  <div
                    className={`mb-3 inline-block rounded-lg bg-gradient-to-r ${style.color} p-0.5`}
                  >
                    <div className="rounded-[5px] bg-card px-3 py-1 text-xs font-medium">
                      {style.label}
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{project.title}</h3>
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                  {project.tech_stack && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.tech_stack.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.tech_stack.length > 4 && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          +{project.tech_stack.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.a>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <a
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("projects.viewAll")} &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
