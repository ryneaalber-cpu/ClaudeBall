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
        className="text-sm text-muted hover:text-paper"
      >
        Sign out
      </button>
    </form>
  );
}
