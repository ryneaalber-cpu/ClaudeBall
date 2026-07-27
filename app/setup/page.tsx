import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const existingCount = await prisma.user.count();

  if (existingCount > 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-6">
        <div className="w-full max-w-sm space-y-3 rounded-md bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-display text-xl font-semibold text-paper">
            Already set up
          </p>
          <p className="text-sm text-muted">
            This deployment already has its first account — that&apos;s
            expected, not an error. Joining an existing league? Ask your
            commissioner to add you as a team owner from their league
            dashboard; that&apos;s how every account after the first one
            gets created, with a one-time password they&apos;ll send you
            directly.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-pos-forward hover:underline"
          >
            Go to login →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <SetupForm />
    </main>
  );
}
