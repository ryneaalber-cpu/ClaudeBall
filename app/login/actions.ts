"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/league",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Incorrect email or password.";
        default:
          return "Something went wrong signing in.";
      }
    }
    // Auth.js signals a successful sign-in by throwing a redirect
    // internally — that's not a real error, so let it propagate.
    throw error;
  }
}
