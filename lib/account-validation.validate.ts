/**
 * Checks usernameError and passwordError against valid inputs, invalid
 * inputs, and the exact length boundaries.
 * Run with: npx tsx lib/account-validation.validate.ts
 */

import assert from "node:assert";
import { usernameError, passwordError } from "./account-validation";

// --- Usernames -----------------------------------------------------
assert.strictEqual(usernameError("ryne_a"), null, "letters + underscore, valid");
assert.strictEqual(usernameError("Player123"), null, "mixed case + digits, valid");
assert.strictEqual(usernameError("abc"), null, "exactly 3 chars, the minimum, is valid");
assert.strictEqual(usernameError("a".repeat(20)), null, "exactly 20 chars, the maximum, is valid");
console.log("✓ Valid usernames pass");

assert.ok(usernameError("ab"), "2 chars, below the minimum, is rejected");
assert.ok(usernameError("a".repeat(21)), "21 chars, above the maximum, is rejected");
assert.ok(usernameError("has space"), "a space is rejected");
assert.ok(usernameError("has@symbol"), "a non-underscore symbol is rejected");
assert.ok(usernameError(""), "empty string is rejected");
console.log("✓ Invalid usernames are all rejected with a message");

// --- Passwords -------------------------------------------------------
assert.strictEqual(passwordError("Str0ngPass"), null, "letters + a digit, 10 chars, valid");
assert.strictEqual(passwordError("abcdefg1"), null, "exactly 8 chars with a digit, the minimum, is valid");
console.log("✓ Valid passwords pass");

assert.ok(passwordError("abcdefg"), "7 chars, below the minimum, is rejected");
assert.ok(passwordError("12345678"), "digits only, no letters, is rejected");
assert.ok(passwordError("abcdefgh"), "letters only, no digits, is rejected");
console.log("✓ Invalid passwords are all rejected with a message");
