import { Navbar } from "@/components/layout/navbar";
import { HeroSection } from "@/components/blocks/hero-section";
import { ProjectsPreview } from "@/components/blocks/projects-preview";
import { SkillsPreview } from "@/components/blocks/skills-preview";
import { Footer } from "@/components/layout/footer";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [projectsRes, skillsRes] = await Promise.all([
    api.projects.list("featured=true", { cache: "no-store" }),
    api.skills.list(undefined, { cache: "no-store" }),
  ]);

  return (
    <>
      <Navbar />
      <main>
        <HeroSection projects={(projectsRes.data ?? []).map(p => ({ title: p.title, slug: p.slug, category: p.category }))}>
          <ProjectsPreview projects={projectsRes.data ?? []} />
          <SkillsPreview skills={skillsRes.data ?? []} />
        </HeroSection>
      </main>
      <Footer />
    </>
  );
}
