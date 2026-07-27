"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Creates the very first user account, entirely from the browser — no
 * terminal, no `npm run db:seed`. Only works while the User table is
 * empty; the page that renders this form re-checks that too, but the
 * check is repeated here since a form action is reachable directly.
 *
 * Not a general sign-up flow: this is a private league, so after this
 * one bootstrap account exists, every other account gets created by the
 * commissioner from the "Add team" form (see
 * app/league/[id]/actions.ts), not by strangers finding a /signup page.
 */
export async function createFirstUser(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return "Setup has already been completed — go to /login instead.";
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return "Fill in every field.";
  }
  if (password.length < 8) {
    return "Password should be at least 8 characters.";
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });

  redirect("/login");
}
