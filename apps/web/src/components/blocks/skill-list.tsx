"use client";

import { motion } from "framer-motion";
import type { Skill } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function SkillList({ skills }: { skills: Skill[] }) {
  const { t } = useI18n();

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((skill, i) => (
        <motion.div
          key={skill.slug}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          className="group rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              {skill.category}
            </span>
            <span className="text-xs text-muted-foreground">
              v{skill.version}
            </span>
          </div>

          <h3 className="mb-2 text-lg font-semibold group-hover:text-accent transition-colors">
            {skill.name}
          </h3>
          <p className="mb-5 text-sm text-muted-foreground line-clamp-3">
            {skill.description}
          </p>

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
        </motion.div>
      ))}

      {skills.length === 0 && (
        <div className="col-span-full rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("skills.noSkills")}
        </div>
      )}
    </div>
  );
}
