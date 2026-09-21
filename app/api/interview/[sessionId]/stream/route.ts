import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { getLLMProvider, LLMMessage } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/interview/prompts";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sessionId } = params;
    const body = await req.json();
    const candidateMessage = body.message?.trim();

    if (!candidateMessage) {
      return new Response(
        JSON.stringify({ error: "Message cannot be empty." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify session existence and candidate ownership
    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!interviewSession) {
      return new Response(
        JSON.stringify({ error: "Interview session not found." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      interviewSession.userId !== session.user.id &&
      interviewSession.user.email !== session.user.email
    ) {
      return new Response(
        JSON.stringify({ error: "Access to this interview session is forbidden." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (interviewSession.status !== "IN_PROGRESS") {
      return new Response(
        JSON.stringify({ error: "This interview session has already ended." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save candidate user message to DB immediately
    await prisma.interviewMessage.create({
      data: {
        sessionId,
        role: "user",
        content: candidateMessage,
      },
    });

    // Build system prompt for this track
    const systemPrompt = buildSystemPrompt({
      type: interviewSession.type,
      domain: interviewSession.domain,
      focusArea: interviewSession.focusArea,
      difficulty: interviewSession.difficulty,
    });

    // Construct full conversation history
    const historyMessages: LLMMessage[] = interviewSession.messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Append latest user message
    historyMessages.push({
      role: "user",
      content: candidateMessage,
    });

    const llm = getLLMProvider();

    // Create readable SSE stream
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        let accumulatedText = "";

        try {
          await llm.streamText({
            messages: historyMessages,
            systemInstruction: systemPrompt,
            temperature: 0.7,
            onChunk(chunk) {
              accumulatedText += chunk;
              const ssePayload = `data: ${JSON.stringify({
                type: "token",
                content: chunk,
              })}\n\n`;
              controller.enqueue(encoder.encode(ssePayload));
            },
          });

          // Save completed assistant reply to database
          if (accumulatedText.trim().length > 0) {
            const savedMsg = await prisma.interviewMessage.create({
              data: {
                sessionId,
                role: "assistant",
                content: accumulatedText.trim(),
              },
            });

            const donePayload = `data: ${JSON.stringify({
              type: "done",
              messageId: savedMsg.id,
            })}\n\n`;
            controller.enqueue(encoder.encode(donePayload));
          }

          controller.close();
        } catch (err: any) {
          console.error("[Interview Streaming Error]:", err);
          const errorPayload = `data: ${JSON.stringify({
            type: "error",
            message:
              err?.message ||
              "An error occurred while generating the AI response. Please try sending your answer again.",
          })}\n\n`;
          controller.enqueue(encoder.encode(errorPayload));
          controller.close();
        }
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("[Stream Route Error]:", err);
    return new Response(
      JSON.stringify({ error: "Failed to initiate streaming response." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
