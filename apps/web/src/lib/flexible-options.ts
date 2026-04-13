function normalizeOption(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function mergeFlexibleOptions(...groups: Array<ReadonlyArray<string | null | undefined> | null | undefined>): string[] {
  // Keep existing custom values stable while removing duplicates.
  // 保留已有自定义选项，同时去重，避免历史值被覆盖。
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const group of groups) {
    if (!group) continue;
    for (const item of group) {
      const normalized = normalizeOption(item);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) continue;
      seen.add(key);
      merged.push(normalized);
    }
  }

  return merged;
}

export function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return mergeFlexibleOptions(value.map((item) => (typeof item === "string" ? item : String(item ?? ""))));
}
