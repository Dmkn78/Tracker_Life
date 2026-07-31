import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  return Response.json({
    settings: {
      calorieTarget: user.calorieTarget,
      defaultSleepDelayMin: user.defaultSleepDelayMin,
      theme: "dark"
    }
  });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = await request.json();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      calorieTarget: Number.isFinite(Number(body.calorieTarget)) ? Number(body.calorieTarget) : undefined,
      defaultSleepDelayMin: Number.isFinite(Number(body.defaultSleepDelayMin))
        ? Number(body.defaultSleepDelayMin)
        : undefined
    }
  });
  return Response.json({
    settings: {
      calorieTarget: updated.calorieTarget,
      defaultSleepDelayMin: updated.defaultSleepDelayMin,
      theme: "dark"
    }
  });
}
