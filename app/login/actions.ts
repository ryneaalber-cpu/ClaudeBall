"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/league",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Incorrect username or password.";
        default:
          return "Something went wrong signing in.";
      }
    }
    // Auth.js signals a successful sign-in by throwing a redirect
    // internally — that's not a real error, so let it propagate.
    throw error;
  }
}
