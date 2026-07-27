/**
 * Creates the first user so there's someone who can actually log in.
 * There's no public sign-up page on purpose — this is a private league,
 * not a service strangers join, so accounts are meant to be created by
 * the commissioner (via this script, then later via an invite flow) not
 * self-registered.
 *
 * Run with: npm run db:seed
 * Set COMMISSIONER_EMAIL / COMMISSIONER_PASSWORD in .env first, or edit
 * the fallback values below directly for a quick local test.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.COMMISSIONER_EMAIL ?? "you@example.com";
  const password = process.env.COMMISSIONER_PASSWORD ?? "change-this-password";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Commissioner", passwordHash },
    update: { passwordHash },
  });

  console.log(`Seeded commissioner account: ${user.email}`);
  if (!process.env.COMMISSIONER_EMAIL) {
    console.log(
      `(Using the placeholder email/password — set COMMISSIONER_EMAIL and COMMISSIONER_PASSWORD in .env and re-run to use your own.)`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
