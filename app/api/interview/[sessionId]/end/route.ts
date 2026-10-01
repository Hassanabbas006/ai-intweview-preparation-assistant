import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { ReportPersistenceService } from "@/services/report-persistence";

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

    // 1. Mark session COMPLETED according to existing logic
    const updated = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // 2. Determine report state via Phase 4A-2 persistence service
    // ARCHITECTURAL CONTRACT:
    // - Does NOT claim pending EvaluationJobs
    // - Does NOT retry EvaluationJobs
    // - Does NOT call EvaluationWorker
    // - Does NOT make LLM calls
    let reportStatus: string = "WAITING_FOR_EVALUATIONS";
    try {
      const report = await ReportPersistenceService.getOrGenerateReport(sessionId);
      reportStatus = report.status;
    } catch (reportErr) {
      console.error(`[End Session] Error generating report for ${sessionId}:`, reportErr);
      reportStatus = "WAITING_FOR_EVALUATIONS";
    }

    const elapsedMs = Date.now() - t0;
    console.log(
      `[API Timing: End Session] Completed session ${sessionId} (reportStatus: ${reportStatus}) in ${elapsedMs}ms`
    );

    const reportUrl = `/interview/${sessionId}/report`;
    const responsePayload = {
      sessionId,
      sessionStatus: "COMPLETED",
      reportStatus,
      reportUrl,
      session: updated,
      timingMs: elapsedMs,
    };

    return NextResponse.json(
      {
        error: false,
        message: "Interview session has ended successfully.",
        sessionId,
        sessionStatus: "COMPLETED",
        reportStatus,
        reportUrl,
        data: responsePayload,
      },
      { status: 200 }
    );
  } catch (err) {
    const elapsedMs = Date.now() - t0;
    console.error(`[API Timing: End Session Error] Failed after ${elapsedMs}ms:`, err);
    return errorResponse("Failed to complete interview session.", 500, err);
  }
}
