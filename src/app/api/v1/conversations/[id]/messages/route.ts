import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { parseJson } from "@/lib/json";
import { ReportDocumentSchema, type ReportBlock } from "@/services/ai/schemas";
import type { FollowUpContext } from "@/services/ai/context";
import { streamAnswer } from "@/services/ai";

const MessageSchema = z.object({
  question: z.string().trim().min(2).max(1200),
});

function blockText(block: ReportBlock): string {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "list":
      return block.items.join("\n");
    case "numberCards":
      return block.numbers
        .map((number) => `${number.label}: ${number.value} — ${number.title}. ${number.detail}`)
        .join("\n");
    case "featureCards":
      return block.features
        .map((feature) => `${feature.name} (${feature.status}): ${feature.observation} ${feature.interpretation}`)
        .join("\n");
    case "planetTable":
      return block.rows
        .map((row) => `${row.name}: ${row.sign} ${row.degree.toFixed(2)}°, ${row.nakshatra} pada ${row.pada}`)
        .join("\n");
    case "dashaTimeline":
      return block.periods.map((period) => `${period.lord}: ${period.start} – ${period.end}`).join("\n");
    case "callout":
      return `${block.title}: ${block.text}`;
    case "calculation":
      return `${block.title}: ${block.steps.join(" → ")}`;
    case "reflections":
      return block.prompts.join("\n");
    default:
      return "";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "conversation:message", 20);
    const { id } = await params;
    const body = await readJson(request, MessageSchema);

    const conversation = await prisma.aIConversation.findUnique({ where: { id } });
    if (!conversation || conversation.userId !== user.id) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Conversation not found.", 404);
    }
    if (!conversation.readingId) {
      throw new AppError(ERROR_CODES.INVALID_STATE, "This conversation has no reading attached.", 409);
    }

    const [reading, consent, report] = await Promise.all([
      prisma.completeReading.findUnique({ where: { id: conversation.readingId } }),
      prisma.consentRecord.findFirst({
        where: {
          readingId: conversation.readingId,
          userId: user.id,
          purpose: "AI_PROCESSING",
          granted: true,
          withdrawnAt: null,
        },
      }),
      prisma.completeLifeReport.findFirst({
        where: { readingId: conversation.readingId, userId: user.id },
        orderBy: { version: "desc" },
      }),
    ]);
    if (!reading || reading.userId !== user.id || reading.status === "DELETED") {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
    }
    if (!consent) {
      throw new AppError(ERROR_CODES.CONSENT_REQUIRED, "AI processing consent is required for follow-up questions.", 403);
    }
    if (!report) {
      throw new AppError(ERROR_CODES.INVALID_STATE, "Your report is not ready yet.", 409);
    }

    const parsed = ReportDocumentSchema.safeParse(parseJson<unknown>(report.reportContent, null));
    if (!parsed.success) {
      throw new AppError(ERROR_CODES.INVALID_STATE, "The saved report could not be read.", 409);
    }
    const document = parsed.data;
    const sections = document.sections.map((section) => ({
      title: section.title,
      text: [section.intro, ...section.blocks.map(blockText)].filter(Boolean).join("\n"),
    }));
    const context: FollowUpContext = {
      preferredName: document.preferredName,
      language: document.language,
      question: body.question,
      sections,
      readingMeta: `Report version ${report.version}. Methods: ${document.methods
        .map((method) => `${method.module} (${method.status})`)
        .join(", ")}.`,
    };

    await prisma.aIMessage.create({
      data: { conversationId: conversation.id, role: "user", content: body.question },
    });
    if (conversation.title === "Ask about my reading") {
      await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { title: body.question.slice(0, 80) },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let answer = "";
        try {
          for await (const chunk of await streamAnswer({
            userPrompt: body.question,
            context,
            userId: user.id,
            readingId: conversation.readingId ?? undefined,
          })) {
            answer += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        } catch {
          const message = "The assistant could not answer just now. Your report is unchanged — please try again.";
          answer += message;
          controller.enqueue(encoder.encode(message));
        } finally {
          if (answer.trim()) {
            await prisma.aIMessage
              .create({ data: { conversationId: conversation.id, role: "assistant", content: answer } })
              .catch(() => undefined);
            await prisma.aIConversation
              .update({ where: { id: conversation.id }, data: { updatedAt: new Date() } })
              .catch(() => undefined);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
