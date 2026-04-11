import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";

export const metadata: Metadata = {
  title: "Workspace — Neo",
  description: "Personal workspace dashboard",
};

export default function WorkspacePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Workspace</h1>
        <p className="mb-12 text-muted-foreground">
          Automation tasks, integrations, and deployment status
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {["Projects", "Posts", "Skills", "Tasks"].map((label) => (
            <div
              key={label}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-bold">—</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
