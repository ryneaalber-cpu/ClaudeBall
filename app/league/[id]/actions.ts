"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface AddTeamResult {
  status: "error" | "success";
  message: string;
}

/**
 * Adds a team owned by an EXISTING account, looked up by username only
 * — no email, no password to generate or relay. This only works once
 * that person has registered themselves at /register; the commissioner
 * never creates or sees anyone else's account here, just links a team
 * to one that already exists.
 */
export async function addTeam(
  leagueId: string,
  _prevState: AddTeamResult | undefined,
  formData: FormData
): Promise<AddTeamResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "You need to be signed in." };
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    return { status: "error", message: "Only the commissioner can add teams." };
  }

  const teamName = formData.get("teamName") as string;
  const ownerUsername = ((formData.get("ownerUsername") as string) || "").trim();

  if (!teamName || !ownerUsername) {
    return { status: "error", message: "Fill in every field." };
  }

  const owner = await prisma.user.findUnique({ where: { username: ownerUsername } });
  if (!owner) {
    return {
      status: "error",
      message: `No account found for username "${ownerUsername}" — ask them to register at /register first, then try again.`,
    };
  }

  await prisma.leagueMembership.upsert({
    where: { userId_leagueId: { userId: owner.id, leagueId } },
    create: { userId: owner.id, leagueId, role: "OWNER" },
    update: {},
  });

  await prisma.team.create({
    data: { name: teamName, leagueId, ownerId: owner.id },
  });

  revalidatePath(`/league/${leagueId}`);

  return {
    status: "success",
    message: `Added ${teamName}, owned by ${ownerUsername}.`,
  };
}
