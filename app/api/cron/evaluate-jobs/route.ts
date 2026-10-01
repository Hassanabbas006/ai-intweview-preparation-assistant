import { NextRequest, NextResponse } from "next/server";
import { EvaluationWorker } from "@/services/evaluation-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max execution duration in seconds (Edge / Node serverless)

/**
 * Production worker dispatch handler for recurring cron execution and manual drain triggers.
 * Handles both GET (standard cron monitors) and POST requests.
 */
export async function GET(req: NextRequest) {
  return handleJobProcessing(req);
}

export async function POST(req: NextRequest) {
  return handleJobProcessing(req);
}

async function handleJobProcessing(req: NextRequest) {
  const startTime = Date.now();

  // 1. Authorization check if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-cron-secret");
    const bearerMatch = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (bearerMatch !== cronSecret && cronHeader !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid CRON_SECRET" },
        { status: 401 }
      );
    }
  }

  // 2. Parse batch and duration parameters
  const { searchParams } = new URL(req.url);
  const batchSize = parseInt(searchParams.get("batchSize") || "25", 10);
  const maxDurationMs = parseInt(searchParams.get("maxDurationMs") || "25000", 10);
  const leaseDurationMs = parseInt(searchParams.get("leaseDurationMs") || "60000", 10);

  const workerId = `cron_worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const processedCount = await EvaluationWorker.processAllPendingJobs({
      batchSize: isNaN(batchSize) ? 25 : Math.min(batchSize, 100),
      maxDurationMs: isNaN(maxDurationMs) ? 25000 : Math.min(maxDurationMs, 50000),
      leaseDurationMs: isNaN(leaseDurationMs) ? 60000 : leaseDurationMs,
      workerId,
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      workerId,
      processedCount,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Evaluation Cron Worker Error]:", error);
    return NextResponse.json(
      {
        success: false,
        workerId,
        error: error?.message || "Internal evaluation worker error",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
