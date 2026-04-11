import type { Metadata } from "next";
import { AdminModeBar } from "@/components/layout/admin-mode-bar";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neo — Personal Workspace & Portfolio",
  description:
    "A showcase of LLM, autonomous driving (VLA), multimodal, and world model projects, plus OpenClaw skills and automation tools.",
  openGraph: {
    title: "Home",
    description: "Personal Workspace & Portfolio",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          {children}
          <AdminModeBar />
        </Providers>
      </body>
    </html>
  );
}
