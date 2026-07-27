import { type DefaultSession } from "next-auth";

// By default, Auth.js's session.user only types name/email/image. The app
// needs the user's id (to look up league memberships, ownership, etc.),
// which the callbacks in auth.ts add at runtime — this just tells
// TypeScript about it.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
