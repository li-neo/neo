"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MarkdownRenderer } from "@/components/blocks/markdown-renderer";
import { api, type Post } from "@/lib/api";
import { dateLocale, useI18n } from "@/lib/i18n";

const TOKEN_KEY = "neo-admin-token";

type DetailState = "loading" | "ready" | "not_found";

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { t, locale } = useI18n();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<DetailState>("loading");

  useEffect(() => {
    if (!slug) {
      setState("not_found");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState("loading");
      const token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await api.posts.get(slug, { cache: "no-store", headers });

      if (cancelled) return;

      if (res.code !== 0 || !res.data) {
        setPost(null);
        setState("not_found");
        return;
      }

      setPost(res.data);
      setState("ready");
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pt-24 pb-16">
        <div className="mb-8">
          <Link href="/blog" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            &larr; {t("blog.backToList")}
          </Link>
        </div>

        {state === "loading" && (
          <div className="rounded-3xl border border-border/50 bg-card p-10 text-center text-muted-foreground">
            {t("blog.loadingPost")}
          </div>
        )}

        {state === "not_found" && (
          <div className="rounded-3xl border border-dashed border-border/50 bg-card p-10 text-center">
            <p className="text-lg font-medium text-foreground">{t("blog.postNotFound")}</p>
          </div>
        )}

        {state === "ready" && post && (
          <article className="space-y-8">
            <header className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <time>
                  {new Date(post.created_at).toLocaleDateString(dateLocale(locale), {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <span>&middot;</span>
                <span>
                  {post.reading_time} {t("blog.minRead")}
                </span>
                <span>&middot;</span>
                <span>
                  {post.views} {t("blog.views")}
                </span>
                {!post.published && (
                  <>
                    <span>&middot;</span>
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                      {t("blog.draft")}
                    </span>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  {post.title}
                </h1>
                {post.summary && (
                  <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                    {post.summary}
                  </p>
                )}
              </div>

              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {post.cover_url && (
              <div className="overflow-hidden rounded-3xl border border-border/50 bg-card">
                <img src={post.cover_url} alt={post.title} className="h-auto w-full object-cover" />
              </div>
            )}

            <div className="rounded-3xl border border-border/50 bg-card p-6 sm:p-8">
              <MarkdownRenderer content={post.content} />
            </div>
          </article>
        )}
      </main>
      <Footer />
    </>
  );
}
