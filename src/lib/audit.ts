import { prisma } from "@/lib/database/prisma";
import { sha256 } from "@/lib/security/crypto";

interface AuditInput {
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, string | number | boolean | null | string[]>;
  ip?: string | null;
}

/**
 * Append-only operational audit trail. Never pass reading content, palm images,
 * birth dates, names, tokens or provider payloads into `metadata`.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        safeMetadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipHash: input.ip ? sha256(input.ip) : null,
      },
    });
  } catch {
    // Audit failures must not break user-facing flows; they surface in monitoring.
    console.error("[audit] failed to persist audit event", input.action);
  }
}
