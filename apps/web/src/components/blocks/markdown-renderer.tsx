"use client";

import React, { cloneElement, isValidElement } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  Rocket,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";

import { slugifyHeading } from "@/lib/markdown-doc";
import { parsePostSourceMeta, sourceLabel, stripPostSourceMeta } from "@/lib/post-content";

const iconMap: Record<string, LucideIcon> = {
  info: Info,
  note: Info,
  tip: Lightbulb,
  warning: AlertCircle,
  success: CheckCircle2,
  rocket: Rocket,
  sparkles: Sparkles,
  terminal: TerminalSquare,
};

function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return flattenText(node.props.children);
  return "";
}

function stripLeadingMarker(node: ReactNode, marker: RegExp, done = { value: false }): ReactNode {
  if (done.value) return node;
  if (typeof node === "string") {
    const next = node.replace(marker, "");
    if (next !== node) done.value = true;
    return next;
  }
  if (typeof node === "number") return node;
  if (Array.isArray(node)) {
    return node.map((item) => stripLeadingMarker(item, marker, done));
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return cloneElement(node, {
      ...node.props,
      children: stripLeadingMarker(node.props.children, marker, done),
    });
  }
  return node;
}

function headingId(children: ReactNode) {
  return slugifyHeading(flattenText(children));
}

function renderHeading(level: "h1" | "h2" | "h3" | "h4", children: ReactNode) {
  const id = headingId(children);
  const className =
    level === "h1"
      ? "mt-8 text-3xl font-bold tracking-tight"
      : level === "h2"
        ? "mt-10 text-2xl font-semibold tracking-tight"
        : level === "h3"
          ? "mt-8 text-xl font-semibold"
          : "mt-6 text-lg font-semibold";
  const Tag = level;
  return (
    <Tag id={id} className={className}>
      <a href={`#${id}`} className="no-underline">
        {children}
      </a>
    </Tag>
  );
}

export function MarkdownRenderer({ content }: { content: string | null | undefined }) {
  const source = parsePostSourceMeta(content);
  const markdown = stripPostSourceMeta(content);
  const label = sourceLabel(source.sourceType);
  const components: any = {
    h1: ({ children }: any) => renderHeading("h1", children),
    h2: ({ children }: any) => renderHeading("h2", children),
    h3: ({ children }: any) => renderHeading("h3", children),
    h4: ({ children }: any) => renderHeading("h4", children),
    table: ({ children }: any) => (
      <div className="my-6 overflow-x-auto rounded-2xl border border-border/60">
        <table className="min-w-full border-collapse bg-card text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-muted/40">{children}</thead>,
    th: ({ children }: any) => (
      <th className="border-b border-border/60 px-4 py-3 text-left font-semibold text-foreground">{children}</th>
    ),
    td: ({ children }: any) => <td className="border-b border-border/40 px-4 py-3 align-top">{children}</td>,
    img: ({ src, alt, title }: any) => (
      <figure className="my-8 overflow-hidden rounded-3xl border border-border/50 bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src || ""} alt={alt || ""} className="h-auto w-full object-cover" />
        {(title || alt) && (
          <figcaption className="border-t border-border/50 px-4 py-3 text-sm text-muted-foreground">
            {title || alt}
          </figcaption>
        )}
      </figure>
    ),
    code: ({ inline, children, className }: any) =>
      inline ? (
        <code className="rounded-md bg-muted px-1.5 py-0.5 text-[0.92em] text-accent">{children}</code>
      ) : (
        <code className={className}>{children}</code>
      ),
    blockquote: ({ children }: any) => {
      const raw = flattenText(children).trim();
      const match = raw.match(/^\[!(TIP|NOTE|WARNING|SUCCESS)\]\s*/i);
      if (!match) {
        return <blockquote className="border-l-4 border-accent/30 pl-4 italic text-muted-foreground">{children}</blockquote>;
      }
      const type = match[1].toLowerCase();
      const marker = new RegExp(`^\\[!${match[1]}\\]\\s*`, "i");
      const cleaned = stripLeadingMarker(children, marker);
      const Icon = iconMap[type] ?? Info;
      const title =
        type === "tip" ? "Tip" : type === "note" ? "Note" : type === "warning" ? "Warning" : "Success";

      return (
        <div className="my-6 rounded-2xl border border-border/60 bg-muted/30 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-accent" />
            <span>{title}</span>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert">{cleaned}</div>
        </div>
      );
    },
    icon: ({ name }: any) => {
      const key = String(name || "sparkles").toLowerCase();
      const Icon = iconMap[key] ?? Sparkles;
      return <Icon className="mx-1 inline h-4 w-4 translate-y-[-1px] text-accent" />;
    },
    p: ({ children }: any) => <p className="leading-8 text-foreground/92">{children}</p>,
    hr: () => <hr className="my-10 border-border/60" />,
  };

  return (
    <div className="space-y-4">
      {(label || source.sourceUrl) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
          {label && (
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              {label}
            </span>
          )}
          {source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate text-accent underline underline-offset-4"
            >
              {source.sourceUrl}
            </a>
          )}
        </div>
      )}

      <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-pre:overflow-x-auto prose-a:text-accent prose-img:rounded-2xl prose-img:border prose-img:border-border/60 prose-table:text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
