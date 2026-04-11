"use client";

import { useI18n, type TKey } from "@/lib/i18n";

export function PageHeader({ titleKey, subtitleKey }: { titleKey: TKey; subtitleKey: TKey }) {
  const { t } = useI18n();

  return (
    <>
      <h1 className="mb-4 text-4xl font-bold tracking-tight">{t(titleKey)}</h1>
      <p className="mb-12 text-muted-foreground">{t(subtitleKey)}</p>
    </>
  );
}
