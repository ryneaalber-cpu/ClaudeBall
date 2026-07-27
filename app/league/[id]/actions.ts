"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateTempPassword } from "@/lib/temp-password";

export interface AddTeamResult {
  status: "error" | "success";
  message: string;
}

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
  const ownerName = formData.get("ownerName") as string;
  const ownerEmail = formData.get("ownerEmail") as string;

  if (!teamName || !ownerName || !ownerEmail) {
    return { status: "error", message: "Fill in every field." };
  }

  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  let tempPassword: string | undefined;

  if (!owner) {
    tempPassword = generateTempPassword();
    owner = await prisma.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        passwordHash: await bcrypt.hash(tempPassword, 10),
      },
    });
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

  return tempPassword
    ? {
        status: "success",
        message: `Added ${teamName}. ${ownerName}'s temporary password is "${tempPassword}" — share it with them directly; it won't be shown again.`,
      }
    : {
        status: "success",
        message: `Added ${teamName}, owned by the existing account for ${ownerEmail}.`,
      };
}
