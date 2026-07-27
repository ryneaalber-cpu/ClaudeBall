import { redirect } from "next/navigation";

/**
 * Superseded by /register — this app no longer has a "first account
 * only" bootstrap flow, since anyone can self-register at any time.
 * Kept as a redirect rather than deleted outright, in case anyone
 * still has this URL bookmarked from before that changed.
 */
export default function SetupPage() {
  redirect("/register");
}
