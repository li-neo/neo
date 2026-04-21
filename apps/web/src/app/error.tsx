"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
      <p className="max-w-md text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-600/20 transition-all hover:from-red-500 hover:to-orange-400"
      >
        Try again
      </button>
    </div>
  );
}
