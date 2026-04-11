import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SkillList } from "@/components/blocks/skill-list";
import { PageHeader } from "@/components/blocks/page-header";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Skills — Neo",
  description: "OpenClaw skills, MCP services, and developer tools",
};

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const res = await api.skills.list(undefined, { cache: "no-store" });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <PageHeader titleKey="skills.title" subtitleKey="skills.browseCreate" />
        <SkillList skills={res.data ?? []} />
      </main>
      <Footer />
    </>
  );
}
