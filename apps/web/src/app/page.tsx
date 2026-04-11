import { Navbar } from "@/components/layout/navbar";
import { HeroSection } from "@/components/blocks/hero-section";
import { ProjectsPreview } from "@/components/blocks/projects-preview";
import { SkillsPreview } from "@/components/blocks/skills-preview";
import { BlogPreview } from "@/components/blocks/blog-preview";
import { Footer } from "@/components/layout/footer";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [projectsRes, skillsRes, postsRes] = await Promise.all([
    api.projects.list("featured=true", { cache: "no-store" }),
    api.skills.list(undefined, { cache: "no-store" }),
    api.posts.list("page_size=3", { cache: "no-store" }),
  ]);

  return (
    <>
      <Navbar />
      <main>
        <HeroSection projects={(projectsRes.data ?? []).map(p => ({ title: p.title, slug: p.slug, category: p.category }))} />
        <div className="relative z-10 rounded-t-[2.5rem] bg-[var(--color-background)] shadow-[0_-20px_60px_rgba(0,0,0,0.3)]">
          <div className="pt-20 pb-8">
            <ProjectsPreview projects={projectsRes.data ?? []} />
            <SkillsPreview skills={skillsRes.data ?? []} />
            <BlogPreview posts={postsRes.data ?? []} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
