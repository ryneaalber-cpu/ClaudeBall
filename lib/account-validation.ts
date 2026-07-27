/**
 * Validation rules for registration — pure so they're testable without
 * a database, and so the exact definition of "valid username" or
 * "strong enough password" lives in exactly one place instead of
 * silently drifting between the form's client-side hints and the
 * server action's real check.
 */

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export function usernameError(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return "Username must be 3-20 characters: letters, numbers, and underscores only.";
  }
  return null;
}

/**
 * "Strong" here means: long enough to resist guessing, and not just a
 * single character class (not just letters, not just digits) — a real
 * strength meter is more than this project needs, but "password" and
 * "12345678" should both still be rejected.
 */
export function passwordError(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "Password must include at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  return null;
}
