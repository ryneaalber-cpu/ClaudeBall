import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="rounded-sm border border-line px-3 py-1.5 text-xs font-medium text-paper transition hover:border-red-400 hover:text-red-400"
      >
        Sign out
      </button>
    </form>
  );
}
