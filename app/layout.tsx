import type { Metadata } from "next";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Oswald: condensed display face for headers and big numbers — carries the
// "scoreboard" energy. Inter: body copy, chosen for legibility in a
// data-dense UI. IBM Plex Mono: stat figures, so minute counts and point
// totals read like a ledger.
const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Dynasty Fantasy Hoops",
  description: "League-run dynasty fantasy basketball, on your own platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-body`}
      >
        {children}
      </body>
    </html>
  );
}
