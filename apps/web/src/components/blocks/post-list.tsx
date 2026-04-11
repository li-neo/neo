"use client";

import { motion } from "framer-motion";
import type { Post } from "@/lib/api";
import { useI18n, dateLocale } from "@/lib/i18n";

export function PostList({ posts }: { posts: Post[] }) {
  const { t, locale } = useI18n();

  return (
    <div className="space-y-8">
      {posts.map((post, i) => (
        <motion.article
          key={post.slug}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="group"
        >
          <a
            href={`/blog/${post.slug}`}
            className="flex gap-6 rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-border hover:shadow-lg hover:shadow-accent/5"
          >
            {post.cover_url && (
              <div className="hidden sm:block h-32 w-48 flex-shrink-0 overflow-hidden rounded-xl">
                <img
                  src={post.cover_url}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                <time>
                  {new Date(post.created_at).toLocaleDateString(dateLocale(locale), {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <span>&middot;</span>
                <span>{post.reading_time} {t("blog.minRead")}</span>
                <span>&middot;</span>
                <span>{post.views} {t("blog.views")}</span>
              </div>
              <h2 className="mb-2 text-xl font-semibold group-hover:text-accent transition-colors">
                {post.title}
              </h2>
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                {post.summary}
              </p>
              {post.tags && (
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </a>
        </motion.article>
      ))}

      {posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("blog.noPosts")}
        </div>
      )}
    </div>
  );
}
