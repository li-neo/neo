"use client";

import { motion } from "framer-motion";
import type { Skill } from "@/lib/api";

const CATEGORY_ICONS: Record<string, string> = {
  development: "Code",
  documentation: "FileText",
  devops: "Rocket",
  ml: "Brain",
  data: "Database",
};

export function SkillsPreview({ skills }: { skills: Skill[] }) {
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
            Skills & Tools
          </h2>
          <p className="text-muted-foreground">
            OpenClaw skills, MCP services, and developer tools
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill, i) => (
            <motion.a
              key={skill.slug}
              href={`/skills`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
            >
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
                <span>{skill.install_count.toLocaleString()} installs</span>
              </div>
            </motion.a>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href="/skills"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse all skills &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
