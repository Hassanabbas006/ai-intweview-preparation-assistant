import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { getAptitudeQuestions } from "@/lib/interview/aptitude-bank";
import { successResponse, errorResponse } from "@/lib/api-response";
import { InterviewType, InterviewModality } from "@prisma/client";

const StartInterviewSchema = z.object({
  type: z.enum(["HR", "DOMAIN", "MANAGERIAL", "APTITUDE"] as const),
  domain: z.string().optional().nullable(),
  focusArea: z.string().max(100).optional().nullable(),
  difficulty: z.enum(["JUNIOR", "INTERMEDIATE", "SENIOR", "LEAD"]).default("INTERMEDIATE"),
  modality: z.enum(["TEXT", "VOICE"]).default("TEXT"),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized. Please sign in first.", 401);
    }

    const body = await req.json();
    const validation = StartInterviewSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(
        validation.error.errors[0]?.message || "Invalid interview configuration.",
        400
      );
    }

    const { type, domain, focusArea, difficulty, modality } = validation.data;

    // Retrieve database user
    let user = session.user.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null;

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email.trim().toLowerCase() },
      });
    }

    if (!user) {
      return errorResponse("Candidate account not found.", 404);
    }

    // Determine target career track
    const effectiveDomain = type === "DOMAIN" ? domain || user.domain || "Software_Engineering" : null;

    // Create session in PostgreSQL (< 20ms)
    const newSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        type: type as InterviewType,
        domain: effectiveDomain,
        focusArea: focusArea || null,
        difficulty,
        modality: modality as InterviewModality,
      },
    });

    const elapsed = (performance.now() - t0).toFixed(1);
    console.log(`[API Timing: Start Session] Created session ${newSession.id} in ${elapsed}ms`);

    if (type === "APTITUDE") {
      const questions = getAptitudeQuestions();
      return successResponse(
        {
          sessionId: newSession.id,
          session: newSession,
          questions,
        },
        "Aptitude assessment initialized."
      );
    }

    // Return session immediately (<30ms) so the room mounts instantly.
    // The opening question will stream live in real time upon room mount!
    return successResponse(
      {
        sessionId: newSession.id,
        session: newSession,
      },
      "Interview session initialized successfully."
    );
  } catch (err) {
    console.error(`[API Timing: Start Session] Error after ${(performance.now() - t0).toFixed(1)}ms:`, err);
    return errorResponse("Failed to start interview session.", 500, err);
  }
}

