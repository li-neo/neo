"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Skill } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function SkillsPreview({ skills }: { skills: Skill[] }) {
  const { t } = useI18n();

  return (
    <section className="border-t border-border/40 py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("skills.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("skills.subtitle")}
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill, i) => (
            <motion.div
              key={skill.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
            >
              <Link href={`/skills/${skill.slug}`} className="absolute inset-0" aria-label={skill.name} />
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                  {skill.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  v{skill.version}
                </span>
              </div>
              <h3 className="mb-2 text-lg font-semibold group-hover:text-accent transition-colors">
                {skill.name}
              </h3>
              <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                {skill.description}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  {skill.platform}
                </span>
                <span>{skill.install_count.toLocaleString()} {t("skills.installs")}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href="/skills"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("skills.browseAll")} &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
