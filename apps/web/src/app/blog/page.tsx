import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostList } from "@/components/blocks/post-list";
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
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Blog</h1>
        <p className="mb-12 text-muted-foreground">
          Thoughts on AI research, engineering, and the tools we build
        </p>
        <PostList posts={res.data ?? []} />
      </main>
      <Footer />
    </>
  );
}
