"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import dynamic from "next/dynamic";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { MarkdownRenderer } from "@/components/blocks/markdown-renderer";
import { isRichTextJson, richTextToPlain } from "@/lib/rich-text";
import type { TocItem } from "@/lib/markdown-doc";

const RichViewerLazy = dynamic(
  () => import("@/components/blocks/rich-editor").then(m => m.RichViewer),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl bg-muted/30" /> },
);

type DetailState = "loading" | "ready" | "not_found";

export interface DocMetaItem {
  label: string;
  value: string;
}

export interface DocActionLink {
  label: string;
  href: string;
}

export interface DocHighlight {
  label: string;
  value: string;
}

export function EntityDocLayout({
  backHref,
  backLabel,
  typeLabel,
  icon,
  title,
  summary,
  state,
  notFoundLabel,
  loadingLabel,
  markdown,
  coverUrl,
  coverAlt,
  badges,
  metaItems,
  actionLinks,
  highlights,
  tocItems,
  adminControls,
  titleNode,
  summaryNode,
  coverNode,
  contentNode,
  metaNode,
}: {
  backHref: string;
  backLabel: string;
  typeLabel: string;
  icon?: ReactNode;
  title: string;
  summary?: string | null;
  state: DetailState;
  notFoundLabel: string;
  loadingLabel: string;
  markdown: string;
  coverUrl?: string | null;
  coverAlt: string;
  badges?: string[];
  metaItems: DocMetaItem[];
  actionLinks: DocActionLink[];
  highlights?: DocHighlight[];
  tocItems?: TocItem[];
  adminControls?: ReactNode;
  titleNode?: ReactNode;
  summaryNode?: ReactNode;
  coverNode?: ReactNode;
  contentNode?: ReactNode;
  metaNode?: ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 pt-24 pb-16">
        <div className="mb-8">
          <Link href={backHref} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            &larr; {backLabel}
          </Link>
        </div>

        {state === "loading" && (
          <div className="rounded-3xl border border-border/50 bg-card p-10 text-center text-muted-foreground">
            {loadingLabel}
          </div>
        )}

        {state === "not_found" && (
          <div className="rounded-3xl border border-dashed border-border/50 bg-card p-10 text-center">
            <p className="text-lg font-medium text-foreground">{notFoundLabel}</p>
          </div>
        )}

        {state === "ready" && (
          <article className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-8">
              <header className="overflow-hidden rounded-[2rem] border border-border/50 bg-card">
                <div className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.14),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-6 py-8 sm:px-8 sm:py-10">
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                        {icon ?? <FileText className="h-3.5 w-3.5" />}
                        {typeLabel}
                      </span>
                      {adminControls}
                    </div>

                    <div className="space-y-4">
                      <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                        {titleNode ?? title}
                      </h1>
                      {(summaryNode ?? summary) &&
                        (summaryNode ?? <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{richTextToPlain(summary)}</p>)}
                    </div>

                    {highlights && highlights.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {highlights.map((item) => (
                          <div key={item.label} className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 backdrop-blur">
                            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                            <p className="text-sm font-medium text-foreground">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <section className="space-y-5">
                {badges && badges.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}

              </section>

              {coverNode ??
                (coverUrl && (
                  <div className="overflow-hidden rounded-3xl border border-border/50 bg-card">
                    <img src={coverUrl} alt={coverAlt} className="h-auto w-full object-cover" />
                  </div>
                ))}

              <div className="rounded-3xl border border-border/50 bg-card p-6 sm:p-8">
                {contentNode ?? (
                  isRichTextJson(markdown)
                    ? <RichViewerLazy content={markdown} />
                    : <MarkdownRenderer content={markdown} />
                )}
              </div>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              {metaNode ?? (
                <div className="rounded-3xl border border-border/50 bg-card p-5">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Overview
                  </h2>
                  <div className="space-y-3 text-sm">
                    {metaItems.map((item) => (
                      <div key={item.label} className="rounded-2xl bg-muted/30 px-4 py-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                        <p className="text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tocItems && tocItems.length > 0 && (
                <div className="rounded-3xl border border-border/50 bg-card p-5">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Outline
                  </h2>
                  <nav className="space-y-2 text-sm">
                    {tocItems.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="block rounded-xl px-3 py-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                        style={{ paddingLeft: `${(item.depth - 2) * 12 + 12}px` }}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {actionLinks.length > 0 && (
                <div className="rounded-3xl border border-border/50 bg-card p-5">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Actions
                  </h2>
                  <div className="space-y-3">
                    {actionLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl border border-border/60 px-4 py-3 text-sm transition-colors hover:border-foreground/20 hover:bg-muted/30"
                      >
                        <span className="inline-flex items-center gap-2">
                          {link.label}
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </article>
        )}
      </main>
      <Footer />
    </>
  );
}
