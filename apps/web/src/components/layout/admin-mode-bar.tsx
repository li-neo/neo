"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const TOKEN_KEY = "neo-admin-token";

function toAdminTab(pathname: string): string | null {
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/blog")) return "blog";
  if (pathname.startsWith("/guestbook")) return "guestbook";
  if (pathname.startsWith("/admin")) return null;
  return null;
}

export function AdminModeBar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setReady(true);
      setIsAdmin(false);
      return;
    }

    api.auth.me(token).then((res) => {
      setIsAdmin(Boolean(res.data && res.data.role === "admin"));
      setReady(true);
    }).catch(() => {
      setIsAdmin(false);
      setReady(true);
    });
  }, []);

  const adminTab = useMemo(() => toAdminTab(pathname), [pathname]);
  const manageHref = adminTab ? `/admin?tab=${adminTab}` : "/admin";

  if (!ready || !isAdmin) return null;

  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex justify-end">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-orange-400/20 bg-stone-950/85 px-4 py-3 text-white shadow-2xl backdrop-blur-xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            {t("admin.mode")}
          </p>
          <p className="text-sm text-stone-200">
            {pathname.startsWith("/admin") ? t("admin.dashboard") : t("admin.managing")}
          </p>
        </div>
        {!pathname.startsWith("/admin") && (
          <Link
            href={manageHref}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-stone-100 transition-colors hover:bg-white/10"
          >
            {t("admin.manageSection")}
          </Link>
        )}
        <Link
          href="/admin"
          className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-400"
        >
          {t("admin.openPanel")}
        </Link>
      </div>
    </div>
  );
}
