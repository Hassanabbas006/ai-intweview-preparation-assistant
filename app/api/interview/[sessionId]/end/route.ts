import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const t0 = Date.now();
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized.", 401);
    }

    const { sessionId } = params;

    const existing = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!existing) {
      return errorResponse("Interview session not found.", 404);
    }

    if (
      existing.userId !== session.user.id &&
      existing.user.email !== session.user.email
    ) {
      return errorResponse("Forbidden.", 403);
    }

    const updated = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    const elapsedMs = Date.now() - t0;
    console.log(`[API Timing: End Session] Completed session ${sessionId} in ${elapsedMs}ms`);

    return successResponse(
      { session: updated, timingMs: elapsedMs },
      "Interview session has ended successfully."
    );
  } catch (err) {
    const elapsedMs = Date.now() - t0;
    console.error(`[API Timing: End Session Error] Failed after ${elapsedMs}ms:`, err);
    return errorResponse("Failed to complete interview session.", 500, err);
  }
}
