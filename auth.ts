import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";

// The full auth setup — for the Node.js runtime only (Server
// Components, Server Actions, API routes). See auth.config.ts for why
// middleware.ts specifically cannot import this file directly, and the
// comment in middleware.ts for what actually went wrong when it did.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return null;

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return null;

        // Deliberately just the id — nothing else about the account is
        // ever read from the session anywhere in this app (every page
        // that needs a display name reads username straight from the
        // database via Prisma), so there's no reason for email to even
        // pass through here, let alone end up in the session.
        return { id: user.id };
      },
    }),
  ],
});
