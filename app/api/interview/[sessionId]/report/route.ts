import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { ReportPersistenceService } from "@/services/report-persistence";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const t0 = performance.now();
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized.", 401);
    }

    const { sessionId } = params;

    // 1. Session lookup & ownership verification
    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!interviewSession) {
      return errorResponse("Interview session not found.", 404);
    }

    // Strict ownership verification: never trust client-provided sessionId
    if (
      interviewSession.userId !== session.user.id &&
      interviewSession.user.email !== session.user.email
    ) {
      return errorResponse("Forbidden.", 403);
    }

    // 2. Retrieve report via Phase 4A-2 persistence service
    // ARCHITECTURAL CONTRACT:
    // - Does NOT claim pending EvaluationJobs
    // - Does NOT retry EvaluationJobs
    // - Does NOT call EvaluationWorker
    // - Does NOT make LLM calls
    let reportRecord = await ReportPersistenceService.getReport(sessionId);

    if (!reportRecord) {
      if (req.nextUrl.searchParams.get("generate") === "true") {
        reportRecord = await ReportPersistenceService.getOrGenerateReport(sessionId);
      } else {
        return errorResponse("Report not found for this interview session.", 404);
      }
    } else if (reportRecord.status === "WAITING_FOR_EVALUATIONS") {
      // Re-reconcile in case background evaluation worker has finished pending jobs
      reportRecord = await ReportPersistenceService.getOrGenerateReport(sessionId);
    }

    const elapsedMs = Math.round(performance.now() - t0);
    console.log(
      `[API Timing: Get Report] Retrieved report for ${sessionId} (status: ${reportRecord.status}) in ${elapsedMs}ms`
    );

    // 3. Format response according to lifecycle status
    let publicReportPayload = null;
    if (reportRecord.status === "READY" || reportRecord.status === "PARTIAL") {
      publicReportPayload = {
        overallScore: reportRecord.overallScore,
        overallPerformanceLevel: reportRecord.overallPerformanceLevel,
        startingDifficulty: reportRecord.startingDifficulty,
        finalDifficulty: reportRecord.finalDifficulty,
        difficultyTrajectory: reportRecord.difficultyTrajectory,
        metrics: reportRecord.metrics,
        pillarScores: reportRecord.pillarScores,
        reconciliation: reportRecord.reconciliation,
        synthesisStatus: reportRecord.synthesisStatus,
        executiveSummary: reportRecord.executiveSummary,
        strengths: reportRecord.structuredStrengths || [],
        weaknesses: reportRecord.structuredWeaknesses || [],
        actionableTips: reportRecord.structuredTips || [],
        createdAt: reportRecord.createdAt.toISOString(),
        updatedAt: reportRecord.updatedAt.toISOString(),
      };
    }

    const responseData = {
      sessionId,
      status: reportRecord.status,
      report: publicReportPayload,
    };

    return NextResponse.json(
      {
        error: false,
        message:
          reportRecord.status === "READY"
            ? "Report retrieved successfully."
            : reportRecord.status === "PARTIAL"
            ? "Report retrieved with partial evaluations."
            : reportRecord.status === "WAITING_FOR_EVALUATIONS"
            ? "Evaluations are still processing in background."
            : reportRecord.status === "GENERATING"
            ? "Report is currently generating."
            : "Report generation encountered an error.",
        sessionId,
        status: reportRecord.status,
        report: publicReportPayload,
        data: responseData,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[API Timing: Get Report Error]:", err);
    return errorResponse("Failed to retrieve interview report.", 500, err);
  }
}
