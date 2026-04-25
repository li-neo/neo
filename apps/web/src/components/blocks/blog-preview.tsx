"use client";

import { motion } from "framer-motion";
import type { Post } from "@/lib/api";
import { useI18n, dateLocale } from "@/lib/i18n";
import { richTextToPlain } from "@/lib/rich-text";

export function BlogPreview({ posts }: { posts: Post[] }) {
  const { t, locale } = useI18n();

  if (posts.length === 0) return null;

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
            {t("blog.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("blog.subtitle")}
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {posts.slice(0, 3).map((post, i) => (
            <motion.a
              key={post.slug}
              href={`/blog/${post.slug}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-border hover:shadow-lg hover:shadow-accent/5"
            >
              {post.cover_url && (
                <div className="h-36 w-full overflow-hidden">
                  <img
                    src={post.cover_url}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <time>
                    {new Date(post.created_at).toLocaleDateString(dateLocale(locale), {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <span>&middot;</span>
                  <span>{post.reading_time} {t("blog.minRead")}</span>
                </div>
                <h3 className="mb-2 line-clamp-2 text-base font-semibold group-hover:text-accent transition-colors">
                  {post.title}
                </h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {richTextToPlain(post.summary)}
                </p>
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </motion.a>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t("blog.title")} &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
