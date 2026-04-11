"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, type GuestbookEntry } from "@/lib/api";
import { useI18n, dateLocale } from "@/lib/i18n";

const TOKEN_KEY = "neo-admin-token";

export function GuestbookList({ entries }: { entries: GuestbookEntry[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<GuestbookEntry[]>(entries);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [editingNickname, setEditingNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const visibleEntries = useMemo(() => items, [items]);

  useEffect(() => {
    setItems(entries);
  }, [entries]);

  useEffect(() => {
    const localToken = localStorage.getItem(TOKEN_KEY);
    if (!localToken) return;
    setToken(localToken);
    api.auth.me(localToken).then((res) => {
      setIsAdmin(Boolean(res.data && res.data.role === "admin"));
    }).catch(() => {
      setToken(null);
      setIsAdmin(false);
    });
  }, []);

  const startEdit = (entry: GuestbookEntry) => {
    setEditingId(entry.id);
    setEditingMessage(entry.message);
    setEditingNickname(entry.user.id === 0 ? entry.user.username : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingMessage("");
    setEditingNickname("");
  };

  const saveEdit = async (entry: GuestbookEntry) => {
    if (!token || saving) return;
    setSaving(true);
    try {
      const res = await api.admin.guestbook.update(token, entry.id, {
        message: editingMessage,
        nickname: entry.user.id === 0 ? editingNickname : undefined,
      });
      if (res.code === 0) {
        cancelEdit();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: number) => {
    if (!token || !window.confirm(t("admin.confirm"))) return;
    const res = await api.admin.guestbook.delete(token, id);
    if (res.code === 0) router.refresh();
  };

  return (
    <div className="space-y-4">
      {visibleEntries.map((entry, i) => (
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
              {editingId === entry.id && entry.user.id === 0 ? (
                <input
                  value={editingNickname}
                  onChange={(e) => setEditingNickname(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm font-medium"
                />
              ) : (
                <span className="text-sm font-medium">{entry.user.username}</span>
              )}
              <time className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleDateString(dateLocale(locale), {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>
            {editingId === entry.id ? (
              <textarea
                value={editingMessage}
                onChange={(e) => setEditingMessage(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:border-accent focus:outline-none"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{entry.message}</p>
            )}
          </div>
          {isAdmin && (
            <div className="flex shrink-0 gap-2">
              {editingId === entry.id ? (
                <>
                  <button
                    onClick={() => saveEdit(entry)}
                    disabled={saving}
                    className="rounded-lg border border-accent/30 px-3 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
                  >
                    {t("admin.save")}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {t("admin.cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(entry)}
                    className="rounded-lg border px-3 py-1 text-xs hover:bg-muted"
                  >
                    {t("admin.edit")}
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="rounded-lg border border-red-300/30 px-3 py-1 text-xs text-red-500 hover:bg-red-50/10"
                  >
                    {t("admin.delete")}
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      ))}

      {visibleEntries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-16 text-center text-muted-foreground">
          {t("guestbook.empty")}
        </div>
      )}
    </div>
  );
}
