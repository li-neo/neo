import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ProjectList } from "@/components/blocks/project-list";
import { PageHeader } from "@/components/blocks/page-header";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Projects — Neo",
  description: "LLM, VLA, Multimodal, and World Model projects",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const qs = category ? `category=${category}` : "";
  const res = await api.projects.list(qs, { cache: "no-store" });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <PageHeader titleKey="projects.title" subtitleKey="projects.subtitle" />
        <ProjectList projects={res.data ?? []} activeCategory={category} />
      </main>
      <Footer />
    </>
  );
}
