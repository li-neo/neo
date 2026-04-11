import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostList } from "@/components/blocks/post-list";
import { PageHeader } from "@/components/blocks/page-header";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Blog — Neo",
  description: "Technical writing on AI, engineering, and tools",
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const res = await api.posts.list(undefined, { cache: "no-store" });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <PageHeader titleKey="blog.title" subtitleKey="blog.subtitle" />
        <PostList posts={res.data ?? []} />
      </main>
      <Footer />
    </>
  );
}
