import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "conversation:get", 240);
    const { id } = await params;
    const conversation = await prisma.aIConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation || conversation.userId !== user.id) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Conversation not found.", 404);
    }
    return jsonOk({
      id: conversation.id,
      readingId: conversation.readingId,
      title: conversation.title,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "conversation:delete", 40);
    const { id } = await params;
    const conversation = await prisma.aIConversation.findUnique({ where: { id } });
    if (!conversation || conversation.userId !== user.id) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Conversation not found.", 404);
    }
    await prisma.aIConversation.delete({ where: { id } });
    return jsonOk({ id, status: "DELETED" });
  });
}
