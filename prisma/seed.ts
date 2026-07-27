/**
 * Creates one account so there's someone who can actually log in,
 * without needing the browser-based /register flow — useful for local
 * testing from a terminal. Not how real accounts get created in normal
 * use anymore: anyone can self-register at /register now, so this
 * script is a convenience for local dev, not the primary path.
 *
 * Run with: npm run db:seed
 * Set COMMISSIONER_USERNAME / COMMISSIONER_EMAIL / COMMISSIONER_PASSWORD
 * in .env first, or edit the fallback values below directly for a quick
 * local test.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const username = process.env.COMMISSIONER_USERNAME ?? "commissioner";
  const email = process.env.COMMISSIONER_EMAIL ?? "you@example.com";
  const password = process.env.COMMISSIONER_PASSWORD ?? "change-this-password";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    create: { username, email, passwordHash },
    update: { passwordHash },
  });

  console.log(`Seeded account: ${user.username}`);
  if (!process.env.COMMISSIONER_USERNAME) {
    console.log(
      `(Using the placeholder username/email/password — set COMMISSIONER_USERNAME, COMMISSIONER_EMAIL, and COMMISSIONER_PASSWORD in .env and re-run to use your own.)`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
