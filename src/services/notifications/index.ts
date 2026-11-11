import { prisma } from "@/lib/database/prisma";
import { env } from "@/lib/env";

export type NotificationType =
  | "READING_SUBMITTED"
  | "PALM_COMPLETED"
  | "NUMEROLOGY_COMPLETED"
  | "ASTROLOGY_COMPLETED"
  | "REPORT_READY"
  | "REPORT_FAILED"
  | "DELETION_RECEIVED"
  | "SECURITY";

interface NotifyInput {
  userId: string;
  readingId?: string;
  type: NotificationType;
  title: string;
  body: string;
}

/**
 * In-app notification plus an email adapter. The console adapter intentionally
 * logs only a message id — never birth details, images or report content.
 */
export async function notify(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      readingId: input.readingId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
    },
  });

  if (env.EMAIL_PROVIDER === "resend" && env.EMAIL_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: "recipient-hidden",
          subject: input.title,
          text: input.body,
        }),
      });
    } catch {
      console.error("[email] provider request failed");
    }
  } else {
    console.info(`[email:console] notification ${input.type} queued for user ${input.userId.slice(0, 6)}…`);
  }
}
