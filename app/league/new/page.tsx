import { LeagueForm } from "./league-form";
import { SignOutButton } from "@/components/sign-out-button";

export default function NewLeaguePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="absolute right-6 top-6">
        <SignOutButton />
      </div>
      <LeagueForm />
    </main>
  );
}
