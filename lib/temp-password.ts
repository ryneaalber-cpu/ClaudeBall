/**
 * Generates a short, readable temporary password for a newly-created
 * owner account — something a commissioner can read aloud or paste into
 * a text message, not a high-security secret. It's shown exactly once
 * (only the bcrypt hash is stored), so it has to be relayed to the owner
 * out of band.
 *
 * This is an MVP pattern, not a final one: a "reset your password on
 * first login" flow is the natural next step once there's a page for it.
 */
const WORDS = [
  "hoop", "court", "swish", "rebound", "assist",
  "block", "steal", "dunk", "paint", "arc",
];

export function generateTempPassword(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${digits}`;
}
