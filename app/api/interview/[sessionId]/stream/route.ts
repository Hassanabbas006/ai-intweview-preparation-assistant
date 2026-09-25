import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { getLLMProvider, LLMMessage, extractLLMErrorMessage } from "@/lib/llm";
import { buildOpeningPrompt, buildSystemPrompt } from "@/lib/interview/prompts";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const t0 = Date.now();
  try {
    const session = await getServerSession(authOptions);
    const tAuth = Date.now();

    if (!session?.user?.id && !session?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sessionId } = params;
    const body = await req.json().catch(() => ({}));
    const isOpening = Boolean(body.isOpening);
    const candidateMessage = body.message?.trim();

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
    const tDbLookup = Date.now();

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

    // Build system prompt for this track
    const systemPrompt = buildSystemPrompt({
      type: interviewSession.type,
      domain: interviewSession.domain,
      focusArea: interviewSession.focusArea,
      difficulty: interviewSession.difficulty,
    });
    const tPromptBuilt = Date.now();

    const llm = getLLMProvider();
    const encoder = new TextEncoder();

    // CASE 1: Initial Opening Question Stream
    if (isOpening || (interviewSession.messages.length === 0 && !candidateMessage)) {
      // If messages already exist, don't re-generate opening question
      if (interviewSession.messages.length > 0) {
        return new Response(
          JSON.stringify({ message: "Opening question already generated." }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const openingInstruction = buildOpeningPrompt({
        type: interviewSession.type,
        domain: interviewSession.domain,
        focusArea: interviewSession.focusArea,
        difficulty: interviewSession.difficulty,
      });

      const customStream = new ReadableStream({
        async start(controller) {
          let accumulatedText = "";
          const tStreamStart = Date.now();
          let tFirstToken = 0;
          let activeModel = "";
          let activeProvider = "";

          try {
            await llm.streamText({
              messages: [{ role: "user", content: openingInstruction }],
              systemInstruction: systemPrompt,
              temperature: 0.5,
              maxOutputTokens: 200,
              onMeta(meta) {
                activeProvider = meta.provider;
                activeModel = meta.model;
                const metaPayload = `data: ${JSON.stringify({
                  type: "meta",
                  provider: meta.provider,
                  model: meta.model,
                })}\n\n`;
                controller.enqueue(encoder.encode(metaPayload));
              },
              onChunk(chunk) {
                if (!tFirstToken) {
                  tFirstToken = Date.now();
                }
                accumulatedText += chunk;
                const ssePayload = `data: ${JSON.stringify({
                  type: "token",
                  content: chunk,
                })}\n\n`;
                controller.enqueue(encoder.encode(ssePayload));
              },
            });

            const tStreamEnd = Date.now();

            // Save completed assistant opening question to DB
            let savedMsgId = "";
            if (accumulatedText.trim().length > 0) {
              const savedMsg = await prisma.interviewMessage.create({
                data: {
                  sessionId,
                  role: "assistant",
                  content: accumulatedText.trim(),
                },
              });
              savedMsgId = savedMsg.id;

              const donePayload = `data: ${JSON.stringify({
                type: "done",
                messageId: savedMsg.id,
              })}\n\n`;
              controller.enqueue(encoder.encode(donePayload));
            }

            const tFinished = Date.now();

            // Log high-resolution timing breakdown for session start
            console.log(`
┌────────────────────────────────────────────────────────────┐
│ ⏱️  [TIMING PROFILE: OPENING QUESTION STREAM]
├────────────────────────────────────────────────────────────┤
│ Active Provider & Model     : ${activeProvider || "groq"} (${activeModel || "primary"})
│ 1. NextAuth Session Auth    : ${tAuth - t0}ms
│ 2. PostgreSQL Session Lookup: ${tDbLookup - tAuth}ms
│ 3. Prompt Construction      : ${tPromptBuilt - tDbLookup}ms
│ 4. Time to First Token TTFT : ${tFirstToken ? tFirstToken - tStreamStart : 0}ms
│ 5. LLM Stream Generation    : ${tStreamEnd - tStreamStart}ms (${accumulatedText.length} chars)
│ 6. DB Message Insertion     : ${tFinished - tStreamEnd}ms
│ ──────────────────────────────────────────────────────────
│ TOTAL OPENING TURN DURATION : ${tFinished - t0}ms
└────────────────────────────────────────────────────────────┘
`);

            controller.close();
          } catch (err: any) {
            const detailedMsg = extractLLMErrorMessage(err);
            console.error("[Opening Streaming Error Details]:", detailedMsg, err);
            const errorPayload = `data: ${JSON.stringify({
              type: "error",
              message: detailedMsg || "Failed to generate opening question. Please refresh or retry.",
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
    }

    // CASE 2: Candidate Turn (Regular Conversation Turn)
    if (!candidateMessage) {
      return new Response(
        JSON.stringify({ error: "Message cannot be empty." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save candidate user message to DB immediately
    const tBeforeUserMsgSave = Date.now();
    await prisma.interviewMessage.create({
      data: {
        sessionId,
        role: "user",
        content: candidateMessage,
      },
    });
    const tAfterUserMsgSave = Date.now();

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

    // Create readable SSE stream
    const customStream = new ReadableStream({
      async start(controller) {
        let accumulatedText = "";
        const tStreamStart = Date.now();
        let tFirstToken = 0;
        let activeModel = "";
        let activeProvider = "";

        try {
          await llm.streamText({
            messages: historyMessages,
            systemInstruction: systemPrompt,
            temperature: 0.5,
            maxOutputTokens: 200,
            onMeta(meta) {
              activeProvider = meta.provider;
              activeModel = meta.model;
              const metaPayload = `data: ${JSON.stringify({
                type: "meta",
                provider: meta.provider,
                model: meta.model,
              })}\n\n`;
              controller.enqueue(encoder.encode(metaPayload));
            },
            onChunk(chunk) {
              if (!tFirstToken) {
                tFirstToken = Date.now();
              }
              accumulatedText += chunk;
              const ssePayload = `data: ${JSON.stringify({
                type: "token",
                content: chunk,
              })}\n\n`;
              controller.enqueue(encoder.encode(ssePayload));
            },
          });

          const tStreamEnd = Date.now();

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

          const tFinished = Date.now();

          // Log high-resolution timing breakdown for regular candidate turn
          console.log(`
┌────────────────────────────────────────────────────────────┐
│ ⏱️  [TIMING PROFILE: REGULAR CANDIDATE TURN]
├────────────────────────────────────────────────────────────┤
│ Active Provider & Model     : ${activeProvider || "groq"} (${activeModel || "primary"})
│ 1. NextAuth Session Auth    : ${tAuth - t0}ms
│ 2. PostgreSQL Session Lookup: ${tDbLookup - tAuth}ms
│ 3. User Message DB Save     : ${tAfterUserMsgSave - tBeforeUserMsgSave}ms
│ 4. Prompt Construction      : ${tPromptBuilt - tDbLookup}ms
│ 5. Time to First Token TTFT : ${tFirstToken ? tFirstToken - tStreamStart : 0}ms
│ 6. LLM Stream Generation    : ${tStreamEnd - tStreamStart}ms (${accumulatedText.length} chars)
│ 7. DB Message Insertion     : ${tFinished - tStreamEnd}ms
│ ──────────────────────────────────────────────────────────
│ TOTAL REGULAR TURN DURATION : ${tFinished - t0}ms
└────────────────────────────────────────────────────────────┘
`);

          controller.close();
        } catch (err: any) {
          const detailedMsg = extractLLMErrorMessage(err);
          console.error("[Interview Streaming Error Details]:", detailedMsg, err);
          const errorPayload = `data: ${JSON.stringify({
            type: "error",
            message: detailedMsg || "An error occurred while generating the response. Please try sending your answer again.",
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

