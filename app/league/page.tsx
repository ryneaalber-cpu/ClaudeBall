import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function LeagueIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.leagueMembership.findFirst({
    where: { userId: session.user.id },
  });

  redirect(membership ? `/league/${membership.leagueId}` : "/league/new");
}
