"use client";

import { useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { api } from "@/lib/api";

export function GuestbookForm() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const res = await api.guestbook.create(trimmed, nickname.trim() || undefined);
    if (res.code === 0) {
      setMessage("");
      window.location.reload();
    }
    setSending(false);
  };

  return (
    <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
      <div className="mb-3 flex gap-3">
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder={t("guestbook.nicknamePlaceholder")}
          maxLength={50}
          className="w-40 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={t("guestbook.inputPlaceholder")}
          maxLength={500}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || sending}
          className="shrink-0 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {sending ? t("guestbook.sending") : t("guestbook.send")}
        </button>
      </div>
    </div>
  );
}
