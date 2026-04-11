import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { GuestbookList } from "@/components/blocks/guestbook-list";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Guestbook — Neo",
  description: "Leave a message",
};

export const dynamic = "force-dynamic";

export default async function GuestbookPage() {
  const res = await api.guestbook.list({ cache: "no-store" });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Guestbook</h1>
        <p className="mb-12 text-muted-foreground">
          Sign in with GitHub and leave a message
        </p>
        <GuestbookList entries={res.data ?? []} />
      </main>
      <Footer />
    </>
  );
}
