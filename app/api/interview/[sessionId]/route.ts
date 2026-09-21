import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized.", 401);
    }

    const { sessionId } = params;

    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { id: true, email: true, domain: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!interviewSession) {
      return errorResponse("Interview session not found.", 404);
    }

    // Authorization check
    if (
      interviewSession.userId !== session.user.id &&
      interviewSession.user.email !== session.user.email
    ) {
      return errorResponse("Forbidden.", 403);
    }

    return successResponse(
      { session: interviewSession },
      "Session details retrieved successfully."
    );
  } catch (err) {
    return errorResponse("Failed to load interview session.", 500, err);
  }
}
