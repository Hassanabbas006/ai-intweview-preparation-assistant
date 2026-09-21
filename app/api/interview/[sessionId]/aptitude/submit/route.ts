import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { APTITUDE_QUESTION_BANK } from "@/lib/interview/aptitude-bank";
import { successResponse, errorResponse } from "@/lib/api-response";

const SubmitAptitudeSchema = z.object({
  answers: z.record(z.number()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized.", 401);
    }

    const { sessionId } = params;
    const body = await req.json();
    const validation = SubmitAptitudeSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse("Invalid answers payload.", 400);
    }

    const { answers } = validation.data;

    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!interviewSession) {
      return errorResponse("Interview session not found.", 404);
    }

    if (
      interviewSession.userId !== session.user.id &&
      interviewSession.user.email !== session.user.email
    ) {
      return errorResponse("Forbidden.", 403);
    }

    // Evaluate answers
    let correctCount = 0;
    const totalQuestions = APTITUDE_QUESTION_BANK.length;
    const breakdown: Array<{
      id: string;
      category: string;
      question: string;
      selectedOptionIndex: number | null;
      correctOptionIndex: number;
      isCorrect: boolean;
      explanation: string;
    }> = [];

    for (const q of APTITUDE_QUESTION_BANK) {
      const selected = answers[q.id] !== undefined ? answers[q.id] : null;
      const isCorrect = selected === q.correctIndex;
      if (isCorrect) correctCount++;

      breakdown.push({
        id: q.id,
        category: q.category,
        question: q.question,
        selectedOptionIndex: selected,
        correctOptionIndex: q.correctIndex,
        isCorrect,
        explanation: q.explanation,
      });
    }

    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

    // Save summary message and update session
    await prisma.$transaction([
      prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          score: scorePercentage,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      }),
      prisma.interviewMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: `Aptitude Assessment Completed. Score: ${correctCount}/${totalQuestions} (${scorePercentage}%).`,
        },
      }),
    ]);

    return successResponse(
      {
        score: scorePercentage,
        correctCount,
        totalQuestions,
        breakdown,
      },
      "Aptitude assessment evaluated successfully."
    );
  } catch (err) {
    return errorResponse("Failed to evaluate aptitude assessment.", 500, err);
  }
}
