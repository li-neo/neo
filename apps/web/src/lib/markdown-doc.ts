export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, "")
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractMarkdownToc(markdown: string | null | undefined): TocItem[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const result: TocItem[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (!match) continue;
    const depth = match[1].length;
    const text = match[2].trim();
    if (!text) continue;
    result.push({
      id: slugifyHeading(text),
      text,
      depth,
    });
  }

  return result;
}
