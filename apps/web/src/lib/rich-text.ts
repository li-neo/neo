function normalizeRichTextSource(content: string): string {
  return content.replace(/^\uFEFF/, "").trim();
}

function unwrapBlockArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.blocks)) return record.blocks;
  if (Array.isArray(record.content)) return record.content;
  return null;
}

export function parseRichTextBlocks(content: string | null | undefined): unknown[] | null {
  if (!content) return null;

  let current: unknown = normalizeRichTextSource(content);
  if (typeof current !== "string" || current.length === 0) return null;

  for (let depth = 0; depth < 3; depth += 1) {
    const blocks = unwrapBlockArray(current);
    if (blocks) return blocks;

    if (typeof current !== "string") return null;

    try {
      current = JSON.parse(current);
    } catch {
      return null;
    }
  }

  return unwrapBlockArray(current);
}

export function isRichTextJson(content: string | null | undefined): boolean {
  return parseRichTextBlocks(content) !== null;
}

function extractText(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  if (typeof record.text === "string") {
    out.push(record.text);
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      value.forEach((item) => extractText(item, out));
      continue;
    }

    if (value && typeof value === "object") {
      extractText(value, out);
    }
  }
}

export function richTextToPlain(content: string | null | undefined): string {
  if (!content) return "";

  const normalized = normalizeRichTextSource(content);
  const blocks = parseRichTextBlocks(normalized);
  if (!blocks) return normalized;

  const texts: string[] = [];
  blocks.forEach((block) => extractText(block, texts));
  return texts.join(" ").replace(/\s+/g, " ").trim();
}
