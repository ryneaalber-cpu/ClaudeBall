import type { NextAuthConfig } from "next-auth";

/**
 * The part of the auth setup that's safe for Next.js Middleware, which
 * runs in the Edge Runtime — a restricted environment that can't run
 * Prisma's database engine (or most of Node.js generally). This file
 * has zero providers and zero imports of ./lib/prisma or bcryptjs, on
 * purpose, so middleware.ts can use it without accidentally dragging
 * the database connection into a runtime that can't execute it.
 *
 * auth.ts extends this with the real Credentials provider (which does
 * need Prisma) for everywhere else — Server Components, Server
 * Actions, API routes — all of which run in the full Node.js runtime,
 * not Edge.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
  providers: [],
};
