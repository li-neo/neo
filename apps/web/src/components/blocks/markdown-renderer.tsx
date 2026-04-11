"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parsePostSourceMeta, sourceLabel, stripPostSourceMeta } from "@/lib/post-content";

export function MarkdownRenderer({ content }: { content: string | null | undefined }) {
  const source = parsePostSourceMeta(content);
  const markdown = stripPostSourceMeta(content);
  const label = sourceLabel(source.sourceType);

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

      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-pre:overflow-x-auto prose-a:text-accent">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
