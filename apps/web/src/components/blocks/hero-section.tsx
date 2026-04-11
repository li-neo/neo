"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

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

export function HeroSection({ projects }: { projects?: ProjectInfo[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const projectList = projects && projects.length > 0 ? projects : FALLBACK_PROJECTS;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setScrollProgress(v));

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.92]);
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -60]);
  const immersed = scrollProgress > 0.35;

  const [hoverInfo, setHoverInfo] = useState<{ label: string; sub: string; x: number; y: number; href: string; guestMsg?: string; guestNick?: string } | null>(null);
  const [msgBox, setMsgBox] = useState<{ x: number; y: number } | null>(null);
  const [msgText, setMsgText] = useState("");
  const [msgNick, setMsgNick] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgDone, setMsgDone] = useState(false);

  const guestMessages = useRef<{ message: string; nickname: string }[]>([]);
  useEffect(() => {
    api.guestbook.list().then(r => {
      if (r.data && r.data.length > 0) {
        guestMessages.current = r.data.map(e => ({
          message: e.message.length > 60 ? e.message.slice(0, 57) + "..." : e.message,
          nickname: e.user?.username || "Anonymous",
        }));
      }
    });
  }, []);

  const handleStarHover = useCallback((info: { idx: number; x: number; y: number } | null) => {
    if (!info) { setHoverInfo(null); return; }
    const isProject = info.idx % 3 !== 0;
    if (isProject) {
      const p = projectList[info.idx % projectList.length];
      setHoverInfo({ label: p.title, sub: p.category?.toUpperCase() ?? "PROJECT", x: info.x, y: info.y, href: "/projects" });
    } else {
      const msgs = guestMessages.current;
      if (msgs.length > 0) {
        const m = msgs[info.idx % msgs.length];
        setHoverInfo({ label: `"${m.message}"`, sub: `— ${m.nickname}`, x: info.x, y: info.y, href: "/guestbook", guestMsg: m.message, guestNick: m.nickname });
      } else {
        setHoverInfo({ label: t("hero.leaveMessage"), sub: "GUESTBOOK", x: info.x, y: info.y, href: "/guestbook" });
      }
    }
  }, [projectList, t]);

  const [clickCard, setClickCard] = useState<{ label: string; sub: string; x: number; y: number } | null>(null);
  const cardTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleStarClick = useCallback((idx: number, screenX: number, screenY: number) => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    const isProject = idx % 3 !== 0;
    if (!isProject) {
      setMsgBox({ x: Math.min(screenX, window.innerWidth - 320), y: Math.min(screenY, window.innerHeight - 200) });
      setMsgDone(false);
      setHoverInfo(null);
      return;
    }
    const p = projectList[idx % projectList.length];
    setClickCard({ label: p.title, sub: p.category?.toUpperCase() ?? "PROJECT", x: screenX, y: screenY });
    setHoverInfo(null);
    cardTimer.current = setTimeout(() => { setClickCard(null); router.push("/projects"); }, 1200);
  }, [projectList, router]);

  const sendMessage = useCallback(async () => {
    if (!msgText.trim() || msgSending) return;
    setMsgSending(true);
    const res = await api.guestbook.create(msgText.trim(), msgNick.trim() || undefined);
    setMsgSending(false);
    if (res.code === 0) {
      setMsgDone(true);
      setMsgText("");
      setMsgNick("");
      setTimeout(() => setMsgBox(null), 1500);
    }
  }, [msgText, msgNick, msgSending]);

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
              {hoverInfo.guestMsg ? (
                <div className="max-w-[220px] rounded-xl border border-purple-400/20 bg-black/70 px-3.5 py-2.5 shadow-lg backdrop-blur-xl">
                  <p className="text-xs italic leading-relaxed text-white/80">{hoverInfo.label}</p>
                  <p className="mt-1.5 text-[10px] font-medium text-purple-300/70">{hoverInfo.sub}</p>
                  <p className="mt-1 text-[10px] text-white/30">{t("hero.clickToOpen")}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/15 bg-black/60 px-3 py-2 shadow-lg backdrop-blur-xl">
                  <p className="text-[9px] font-medium uppercase tracking-widest text-orange-400/70">{hoverInfo.sub}</p>
                  <p className="mt-0.5 text-sm font-semibold text-white/90">{hoverInfo.label}</p>
                  <p className="mt-1 text-[10px] text-white/40">{t("hero.clickToOpen")}</p>
                </div>
              )}
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
            <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
              className="mb-8 text-7xl font-bold leading-[1.05] tracking-tighter sm:text-[11rem]">
              <span className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">Neo</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.9, ease: "easeOut" }}
              className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-stone-600/80">
              {t("hero.subtitle")}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.1, ease: "easeOut" }}
              className="pointer-events-auto flex items-center justify-center gap-5">
              <a href="/projects" className="rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-8 py-3.5 text-sm font-medium text-white shadow-lg shadow-orange-600/20 transition-all hover:from-red-500 hover:to-orange-400 hover:shadow-xl">
                {t("hero.viewProjects")}
              </a>
              <a href="/skills" className="rounded-full border border-stone-600/20 px-8 py-3.5 text-sm font-medium text-stone-700 backdrop-blur-sm transition-all hover:border-orange-500/30 hover:bg-orange-50/20 hover:text-stone-900">
                {t("hero.exploreSkills")}
              </a>
            </motion.div>
          </div>
        </motion.div>

        {/* Inline guestbook popup */}
        <AnimatePresence>
          {msgBox && (
            <motion.div
              key="msg-box"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.25 }}
              className="fixed z-50"
              style={{ left: msgBox.x, top: msgBox.y }}
            >
              <div className="w-72 rounded-2xl border border-white/15 bg-black/70 p-4 shadow-2xl backdrop-blur-xl">
                {msgDone ? (
                  <p className="py-4 text-center text-sm text-green-400">✓ {t("admin.saved")}</p>
                ) : (
                  <>
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-orange-400/70">
                      {t("hero.leaveMessage")}
                    </p>
                    <input
                      type="text"
                      value={msgNick}
                      onChange={e => setMsgNick(e.target.value)}
                      placeholder={t("guestbook.nicknamePlaceholder")}
                      maxLength={50}
                      className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-orange-500/50 focus:outline-none"
                    />
                    <textarea
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      placeholder={t("guestbook.inputPlaceholder")}
                      maxLength={500}
                      rows={3}
                      className="mb-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-orange-500/50 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={sendMessage}
                        disabled={!msgText.trim() || msgSending}
                        className="flex-1 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        {msgSending ? t("guestbook.sending") : t("guestbook.send")}
                      </button>
                      <button onClick={() => setMsgBox(null)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white/80">
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!immersed ? (
            <motion.div key="scroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 1.5 }}
              className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2">
              <div className="flex flex-col items-center gap-2 text-stone-500">
                <span className="text-[10px] uppercase tracking-[0.2em]">{t("hero.scrollHint")}</span>
                <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="h-8 w-px bg-gradient-to-b from-stone-500 to-transparent" />
              </div>
            </motion.div>
          ) : (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2">
              <div className="rounded-full bg-black/30 px-4 py-2 text-[11px] text-white/70 backdrop-blur-md">
                {t("hero.hoverHint")}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating NEO-AI chat button — bottom right */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 2 }}
        onClick={() => window.dispatchEvent(new CustomEvent("neo-open-chat"))}
        className="pointer-events-auto fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-orange-400/30 bg-gradient-to-r from-red-600/90 to-orange-500/90 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-orange-600/25 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-orange-600/30 hover:scale-105"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        {t("hero.badge")}
      </motion.button>
    </div>
  );
}
