"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n, type TKey } from "@/lib/i18n";
import { LocaleToggle } from "./locale-toggle";
import { ChatPanel } from "@/components/blocks/chat-panel";

const NAV_ITEMS: { key: TKey; href: string }[] = [
  { key: "nav.projects", href: "/projects" },
  { key: "nav.skills", href: "/skills" },
  { key: "nav.blog", href: "/blog" },
  { key: "nav.guestbook", href: "/guestbook" },
];

export function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener("neo-open-chat", handler);
    return () => window.removeEventListener("neo-open-chat", handler);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 z-50 w-full"
      >
        <div className="mx-auto max-w-6xl px-6">
          <nav className="mt-4 flex h-12 items-center justify-between rounded-full border border-stone-300/30 bg-white/50 px-6 shadow-sm shadow-stone-300/10 backdrop-blur-2xl">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-stone-800 transition-colors hover:text-orange-600"
            >
              Neo
            </Link>
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`relative rounded-full px-4 py-1.5 text-sm transition-colors ${
                        active
                          ? "text-orange-700"
                          : "text-stone-500 hover:text-stone-800"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-full bg-orange-100/50"
                          transition={{
                            type: "spring",
                            bounce: 0.2,
                            duration: 0.5,
                          }}
                        />
                      )}
                      <span className="relative z-10">{t(item.key)}</span>
                    </Link>
                  </li>
                );
              })}

              {/* AI Chat button */}
              <li>
                <button
                  onClick={() => setChatOpen(true)}
                  className="relative ml-1 flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-gradient-to-r from-red-600/10 to-orange-500/10 px-3.5 py-1.5 text-sm font-medium text-orange-600 transition-all hover:from-red-600/20 hover:to-orange-500/20 hover:shadow-sm"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
                  </span>
                  <span className="hidden sm:inline">NEO-AI</span>
                  <svg className="h-3.5 w-3.5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </button>
              </li>

              <li>
                <LocaleToggle className="ml-2 text-stone-500" />
              </li>
            </ul>
          </nav>
        </div>
      </motion.header>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
