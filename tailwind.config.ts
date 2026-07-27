import type { Config } from "tailwindcss";

// Design tokens for the app. See README.md "Design direction" for the
// reasoning — short version: a stat-sheet/scoreboard feel, where the three
// position colors are a functional legend (they're reused everywhere a
// position pool shows up), not decoration.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12151A",
        surface: "#1A1E26",
        surfaceRaised: "#212632",
        paper: "#EDEAE2",
        muted: "#767F91",
        line: "#2A3040",
        pos: {
          center: "#5B8DEF",
          forward: "#E8A13D",
          guard: "#4FBF8B",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
