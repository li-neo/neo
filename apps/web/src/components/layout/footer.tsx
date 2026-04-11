"use client";

import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-stone-300/30 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6">
        <div className="flex items-center gap-8 text-sm">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 transition-colors hover:text-orange-600"
          >
            GitHub
          </a>
          <span className="h-3 w-px bg-stone-300/40" />
          <a
            href="https://huggingface.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 transition-colors hover:text-orange-600"
          >
            Hugging Face
          </a>
          <span className="h-3 w-px bg-stone-300/40" />
          <a
            href="/blog"
            className="text-stone-500 transition-colors hover:text-orange-600"
          >
            {t("blog.title")}
          </a>
        </div>
        <p className="text-xs text-stone-500">
          &copy; {new Date().getFullYear()} Neo. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
