import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Built directly from authConfig, NOT from auth.ts's exported `auth`.
 * Importing auth.ts here would pull its Prisma import along too, and
 * Prisma can't run in the Edge Runtime middleware executes in.
 *
 * This was a real bug in an earlier version of this file: it re-exported
 * auth.ts's `auth` directly, which silently broke `npm run dev` —
 * middleware couldn't be prepared without bundling a Prisma client the
 * Edge Runtime can't execute, and the dev server exited during startup
 * with no clear error printed. The whole app was never actually
 * reachable as a result. Session/JWT verification here still works
 * correctly without the database: it only needs the shared AUTH_SECRET
 * to check a token's signature, not a live connection.
 */
export const { auth: middleware } = NextAuth(authConfig);

// Everything requires sign-in except the login page, /register (where
// anyone creates their own account), the /setup redirect that points
// old links at /register, the auth API routes, and Next's own static
// assets. Add more public paths here if you end up wanting something
// publicly viewable (e.g. read-only standings).
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|setup).*)"],
};
