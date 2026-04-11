"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { label: "Projects", href: "/projects" },
  { label: "Skills", href: "/skills" },
  { label: "Blog", href: "/blog" },
  { label: "Guestbook", href: "/guestbook" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
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
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </motion.header>
  );
}
