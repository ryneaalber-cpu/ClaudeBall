"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_POSITION_POOLS, DEFAULT_SCORING_WEIGHTS } from "@/lib/scoring-engine";

export async function createLeague(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    return "You need to be signed in.";
  }

  const name = formData.get("name") as string;
  const currentSeason = formData.get("currentSeason") as string;
  const capAmount = Number(formData.get("capAmount"));

  if (!name || !currentSeason || !capAmount) {
    return "Fill in every field.";
  }

  const league = await prisma.league.create({
    data: {
      name,
      currentSeason,
      capAmount,
      memberships: {
        create: { userId: session.user.id, role: "COMMISSIONER" },
      },
      // Sensible defaults, both fully editable later from a settings page
      // — same idea as sports.ws letting commissioners define their own
      // scoring, just seeded with a working starting point instead of a
      // blank, intimidating form.
      positionPools: {
        create: DEFAULT_POSITION_POOLS.map((pool) => ({
          position: pool.position,
          minutesTotal: pool.minutePool,
        })),
      },
      scoringCategories: {
        create: Object.entries(DEFAULT_SCORING_WEIGHTS).map(([statKey, weight]) => ({
          statKey,
          label: statKey,
          weight,
        })),
      },
    },
  });

  redirect(`/league/${league.id}`);
}
