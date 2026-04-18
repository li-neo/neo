import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract plain text from BlockNote JSON content for previews/cards.
 * Falls back to the original string if not valid JSON blocks.
 */
export function richTextToPlain(content: string | null | undefined): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (!trimmed.startsWith("[")) return trimmed;
  try {
    const blocks = JSON.parse(trimmed);
    if (!Array.isArray(blocks)) return trimmed;
    const texts: string[] = [];
    for (const block of blocks) {
      extractText(block, texts);
    }
    return texts.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return trimmed;
  }
}

function extractText(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.text === "string") out.push(obj.text);
  if (Array.isArray(obj.content)) obj.content.forEach((c: unknown) => extractText(c, out));
  if (Array.isArray(obj.children)) obj.children.forEach((c: unknown) => extractText(c, out));
}
