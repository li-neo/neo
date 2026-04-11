import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { PageHeader } from "@/components/blocks/page-header";

export const metadata: Metadata = {
  title: "Workspace — Neo",
  description: "Personal workspace dashboard",
};

const CARDS = ["Projects", "Posts", "Skills", "Tasks"];

export default function WorkspacePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <PageHeader titleKey="workspace.title" subtitleKey="workspace.subtitle" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((label) => (
            <div
              key={label}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-bold">&mdash;</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
