import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { GuestbookList } from "@/components/blocks/guestbook-list";
import { GuestbookForm } from "@/components/blocks/guestbook-form";
import { PageHeader } from "@/components/blocks/page-header";
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
        <PageHeader titleKey="guestbook.title" subtitleKey="guestbook.subtitle" />
        <GuestbookForm />
        <GuestbookList entries={res.data ?? []} />
      </main>
      <Footer />
    </>
  );
}
