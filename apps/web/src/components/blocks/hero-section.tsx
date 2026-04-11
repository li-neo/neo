"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRouter } from "next/navigation";

const BlackHoleScene = dynamic(
  () => import("@/components/blocks/black-hole-scene").then((mod) => mod.BlackHoleScene),
  { ssr: false },
);

interface ProjectInfo { title: string; slug: string; category?: string; }

const FALLBACK_PROJECTS: ProjectInfo[] = [
  { title: "LLM Research", slug: "llm-research", category: "llm" },
  { title: "Autonomous Driving", slug: "autonomous-driving", category: "vla" },
  { title: "World Model", slug: "world-model", category: "world_model" },
  { title: "Multimodal AI", slug: "multimodal-ai", category: "multimodal" },
];

export function HeroSection({ projects, children }: { projects?: ProjectInfo[]; children?: React.ReactNode }) {
  const router = useRouter();
  const projectList = projects && projects.length > 0 ? projects : FALLBACK_PROJECTS;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setScrollProgress(v));

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.92]);
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -60]);
  const immersed = scrollProgress > 0.35;

  // content sections appear in the last portion of scroll
  const contentOpacity = useTransform(scrollYProgress, [0.65, 0.8], [0, 1]);
  const contentY = useTransform(scrollYProgress, [0.65, 0.85], [80, 0]);

  const [hoverInfo, setHoverInfo] = useState<{ label: string; sub: string; x: number; y: number; href: string } | null>(null);

  const handleStarHover = useCallback((info: { idx: number; x: number; y: number } | null) => {
    if (!info) { setHoverInfo(null); return; }
    const isProject = info.idx % 3 !== 0;
    if (isProject) {
      const p = projectList[info.idx % projectList.length];
      setHoverInfo({ label: p.title, sub: p.category?.toUpperCase() ?? "PROJECT", x: info.x, y: info.y, href: "/projects" });
    } else {
      setHoverInfo({ label: "Leave a message", sub: "GUESTBOOK", x: info.x, y: info.y, href: "/guestbook" });
    }
  }, [projectList]);

  const [clickCard, setClickCard] = useState<{ label: string; sub: string; x: number; y: number } | null>(null);
  const cardTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleStarClick = useCallback((idx: number, screenX: number, screenY: number) => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    const isProject = idx % 3 !== 0;
    const p = projectList[idx % projectList.length];
    const label = isProject ? p.title : "Leave a message";
    const sub = isProject ? (p.category?.toUpperCase() ?? "PROJECT") : "GUESTBOOK";
    const href = isProject ? "/projects" : "/guestbook";
    setClickCard({ label, sub, x: screenX, y: screenY });
    setHoverInfo(null);
    cardTimer.current = setTimeout(() => { setClickCard(null); router.push(href); }, 1200);
  }, [projectList, router]);

  useEffect(() => () => { if (cardTimer.current) clearTimeout(cardTimer.current); }, []);

  return (
    <div ref={containerRef} className="relative" style={{ height: "400vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <BlackHoleScene
          onStarClick={handleStarClick}
          onStarHover={handleStarHover}
          scrollProgress={scrollProgress}
        />

        <div className="pointer-events-none absolute inset-0 bg-radial-fade z-[1]" />

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoverInfo && !clickCard && (
            <motion.div
              key="hover-tip"
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 6 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none fixed z-50"
              style={{ left: hoverInfo.x + 16, top: hoverInfo.y - 20 }}
            >
              <div className="rounded-lg border border-white/15 bg-black/60 px-3 py-2 shadow-lg backdrop-blur-xl">
                <p className="text-[9px] font-medium uppercase tracking-widest text-orange-400/70">{hoverInfo.sub}</p>
                <p className="mt-0.5 text-sm font-semibold text-white/90">{hoverInfo.label}</p>
                <p className="mt-1 text-[10px] text-white/40">click to open</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click burst card */}
        <AnimatePresence>
          {clickCard && (
            <motion.div
              key="click-card"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="pointer-events-none fixed z-50"
              style={{ left: clickCard.x, top: clickCard.y, transform: "translate(-50%, -50%)" }}
            >
              <div className="rounded-xl border border-orange-400/20 bg-white/85 px-5 py-3 shadow-xl backdrop-blur-2xl">
                <p className="text-[10px] font-medium uppercase tracking-widest text-orange-500/60">{clickCard.sub}</p>
                <p className="mt-0.5 text-sm font-semibold text-stone-800">{clickCard.label}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero text */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        >
          <div className="mx-auto max-w-5xl px-6 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-orange-800/20 bg-white/10 px-5 py-2 text-sm text-orange-900/70 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                Chating with NEO-AI
              </div>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
              className="mb-8 text-6xl font-bold leading-[1.05] tracking-tighter sm:text-9xl">
              <span className="block text-stone-800/90">LLM &middot; VLA &middot;</span>
              <span className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">Multimodal</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.9, ease: "easeOut" }}
              className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-stone-600/80">
              Exploring the frontiers of AI — from large language models and autonomous driving to world models.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.1, ease: "easeOut" }}
              className="pointer-events-auto flex items-center justify-center gap-5">
              <a href="/projects" className="rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-8 py-3.5 text-sm font-medium text-white shadow-lg shadow-orange-600/20 transition-all hover:from-red-500 hover:to-orange-400 hover:shadow-xl">
                View Projects
              </a>
              <a href="/skills" className="rounded-full border border-stone-600/20 px-8 py-3.5 text-sm font-medium text-stone-700 backdrop-blur-sm transition-all hover:border-orange-500/30 hover:bg-orange-50/20 hover:text-stone-900">
                Explore Skills
              </a>
            </motion.div>
          </div>
        </motion.div>

        {/* Content sections that emerge from the 3D scene */}
        {children && (
          <motion.div
            className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[85vh] overflow-y-auto"
            style={{ opacity: contentOpacity, y: contentY }}
          >
            <div className="rounded-t-[2.5rem] bg-[var(--color-background)] shadow-[0_-20px_60px_rgba(0,0,0,0.15)]">
              <div className="pt-16 pb-8">
                {children}
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!immersed ? (
            <motion.div key="scroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 1.5 }}
              className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2">
              <div className="flex flex-col items-center gap-2 text-stone-500">
                <span className="text-[10px] uppercase tracking-[0.2em]">Scroll to enter</span>
                <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="h-8 w-px bg-gradient-to-b from-stone-500 to-transparent" />
              </div>
            </motion.div>
          ) : (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2">
              <div className="rounded-full bg-black/30 px-4 py-2 text-[11px] text-white/70 backdrop-blur-md">
                Hover over a star to see details &middot; click to explore
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
