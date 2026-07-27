"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { usernameError, passwordError } from "@/lib/account-validation";

/**
 * General-purpose self-registration — anyone can create their own
 * account with a username and password they choose themselves. Replaces
 * the old model where only the commissioner could create accounts (with
 * a system-generated temp password that had to be relayed by hand).
 *
 * Email is collected and stored, but it's never displayed anywhere in
 * the app — not to the commissioner, not to other league members, not
 * even echoed back on this page after registering. It exists purely so
 * the account has a recovery contact on file; nothing in this app reads
 * it back out. A commissioner only ever needs a teammate's *username*
 * to add them to a team (see league/[id]/actions.ts).
 */
export async function registerUser(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const username = ((formData.get("username") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim();
  const password = (formData.get("password") as string) || "";

  if (!username || !email || !password) {
    return "Fill in every field.";
  }

  const usernameProblem = usernameError(username);
  if (usernameProblem) return usernameProblem;

  const passwordProblem = passwordError(password);
  if (passwordProblem) return passwordProblem;

  const [existingUsername, existingEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (existingUsername) return "That username is already taken.";
  if (existingEmail) return "An account with that email already exists.";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, email, passwordHash } });

  redirect("/login");
}
