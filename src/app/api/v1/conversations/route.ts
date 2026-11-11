import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";

const CreateSchema = z.object({
  readingId: z.string().min(1).max(60),
  title: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "conversations:list", 120);
    const url = new URL(request.url);
    const readingId = url.searchParams.get("readingId");
    const conversations = await prisma.aIConversation.findMany({
      where: { userId: user.id, ...(readingId ? { readingId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return jsonOk({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        readingId: conversation.readingId,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
        preview: conversation.messages[0]?.content.slice(0, 160) ?? null,
      })),
    });
  });
}

export async function POST(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "conversations:create", 20);
    const body = await readJson(request, CreateSchema);
    const reading = await prisma.completeReading.findUnique({ where: { id: body.readingId } });
    if (!reading || reading.userId !== user.id || reading.status === "DELETED") {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
    }
    const conversation = await prisma.aIConversation.create({
      data: {
        userId: user.id,
        readingId: body.readingId,
        title: body.title || "Ask about my reading",
      },
    });
    return jsonOk({ id: conversation.id, title: conversation.title }, { status: 201 });
  });
}
