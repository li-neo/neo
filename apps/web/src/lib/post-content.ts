export interface PostSourceMeta {
  sourceType: string | null;
  sourceUrl: string | null;
}

const META_PREFIX = "<!-- neo-post-meta:";
const META_SUFFIX = "-->";

export function embedPostSourceMeta(content: string, meta: PostSourceMeta): string {
  const body = stripPostSourceMeta(content).trim();
  if (!meta.sourceType && !meta.sourceUrl) return body;
  const payload = JSON.stringify({
    sourceType: meta.sourceType,
    sourceUrl: meta.sourceUrl,
  });
  return `${META_PREFIX}${payload}${META_SUFFIX}\n\n${body}`.trim();
}

export function stripPostSourceMeta(content: string | null | undefined): string {
  if (!content) return "";
  return content.replace(/^<!-- neo-post-meta:[\s\S]*?-->\s*/, "").trim();
}

export function parsePostSourceMeta(content: string | null | undefined): PostSourceMeta {
  if (!content) return { sourceType: null, sourceUrl: null };
  const match = content.match(/^<!-- neo-post-meta:([\s\S]*?)-->/);
  if (!match) return { sourceType: null, sourceUrl: null };
  try {
    const parsed = JSON.parse(match[1]) as { sourceType?: string | null; sourceUrl?: string | null };
    return {
      sourceType: parsed.sourceType ?? null,
      sourceUrl: parsed.sourceUrl ?? null,
    };
  } catch {
    return { sourceType: null, sourceUrl: null };
  }
}

export function sourceLabel(sourceType: string | null): string | null {
  if (!sourceType) return null;
  switch (sourceType) {
    case "feishu":
      return "Feishu";
    case "notion":
      return "Notion";
    case "pdf":
      return "PDF";
    case "markdown":
      return "Markdown";
    case "html":
      return "HTML";
    default:
      return sourceType;
  }
}
