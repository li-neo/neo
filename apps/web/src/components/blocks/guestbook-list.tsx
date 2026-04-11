"use client";

import { motion } from "framer-motion";
import type { GuestbookEntry } from "@/lib/api";
import { useI18n, dateLocale } from "@/lib/i18n";

export function GuestbookList({ entries }: { entries: GuestbookEntry[] }) {
  const { t, locale } = useI18n();

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="flex items-start gap-4 rounded-xl border border-border/50 bg-card p-4"
        >
          {entry.user.avatar_url ? (
            <img
              src={entry.user.avatar_url}
              alt={entry.user.username}
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
              {entry.user.username[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium">{entry.user.username}</span>
              <time className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleDateString(dateLocale(locale), {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>
            <p className="text-sm text-muted-foreground">{entry.message}</p>
          </div>
        </motion.div>
      ))}

      {entries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("guestbook.empty")}
        </div>
      )}
    </div>
  );
}
