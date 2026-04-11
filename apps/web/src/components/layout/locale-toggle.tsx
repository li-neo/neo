"use client";

import { useI18n } from "@/lib/i18n";

export function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      className={`rounded-full border border-stone-300/30 px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition-colors hover:border-orange-500/30 hover:text-orange-600 ${className}`}
      aria-label="Switch language"
    >
      {locale === "en" ? "中文" : "EN"}
    </button>
  );
}
