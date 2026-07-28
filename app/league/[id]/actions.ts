"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface AddTeamResult {
  status: "error" | "success";
  message: string;
}

async function requireCommissioner(leagueId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    throw new Error("Only the commissioner can do this");
  }
}

/**
 * Adds a team, owner optional. Leaving the username blank creates the
 * team unclaimed — real roster and contracts can exist before the
 * person who'll actually run it has registered; see claimTeam below
 * for attaching a real owner once they have. A username that's typed
 * but doesn't match anyone is still treated as an error rather than
 * silently going unclaimed, since for a single manual add that's far
 * more likely to be a typo worth catching immediately than an
 * intentional placeholder.
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

  if (!teamName) {
    return { status: "error", message: "Team name is required." };
  }

  let ownerId: string | null = null;
  if (ownerUsername) {
    const owner = await prisma.user.findUnique({ where: { username: ownerUsername } });
    if (!owner) {
      return {
        status: "error",
        message: `No account found for username "${ownerUsername}" — ask them to register at /register first, then try again. Leave it blank instead if you want to add this team unclaimed for now.`,
      };
    }
    ownerId = owner.id;
    await prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: owner.id, leagueId } },
      create: { userId: owner.id, leagueId, role: "OWNER" },
      update: {},
    });
  }

  await prisma.team.create({
    data: { name: teamName, leagueId, ownerId },
  });

  revalidatePath(`/league/${leagueId}`);

  return {
    status: "success",
    message: ownerId
      ? `Added ${teamName}, owned by ${ownerUsername}.`
      : `Added ${teamName}, unclaimed — claim it later once its real owner registers.`,
  };
}

/**
 * Attaches a real owner to a team that was imported or added unclaimed.
 * Only works if the team genuinely has no owner yet, to avoid
 * accidentally reassigning a team someone's already using.
 */
export async function claimTeam(
  leagueId: string,
  teamId: string,
  _prevState: AddTeamResult | undefined,
  formData: FormData
): Promise<AddTeamResult | undefined> {
  await requireCommissioner(leagueId);

  const username = ((formData.get("username") as string) || "").trim();
  if (!username) {
    return { status: "error", message: "Enter a username." };
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.leagueId !== leagueId) {
    return { status: "error", message: "Team not found." };
  }
  if (team.ownerId) {
    return { status: "error", message: "This team already has an owner." };
  }

  const owner = await prisma.user.findUnique({ where: { username } });
  if (!owner) {
    return {
      status: "error",
      message: `No account found for username "${username}" — they need to register at /register first.`,
    };
  }

  await prisma.$transaction([
    prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: owner.id, leagueId } },
      create: { userId: owner.id, leagueId, role: "OWNER" },
      update: {},
    }),
    prisma.team.update({ where: { id: teamId }, data: { ownerId: owner.id } }),
  ]);

  revalidatePath(`/league/${leagueId}`);

  return { status: "success", message: `${team.name} is now owned by ${username}.` };
}
