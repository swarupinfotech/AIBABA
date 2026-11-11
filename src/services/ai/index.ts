import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { env } from "@/lib/env";
import { AIProviderError, estimateCost, type AIProvider, type AIRequest, type AIChatRequest } from "@/services/ai/types";
import { LocalInterpretationProvider } from "@/services/ai/local";
import { OpenAIProvider } from "@/services/ai/openai";
import { GeminiProvider } from "@/services/ai/gemini";
import { BASE_SYSTEM_INSTRUCTION, PROMPTS, type PromptKey } from "@/services/ai/types";
import { SafetyValidationSchema, type SafetyValidation } from "@/services/ai/schemas";
import { LocalInterpretationProvider as SafetyLocal } from "@/services/ai/local";

const AIConfigSchema = z.object({
  provider: z.enum(["local", "openai", "gemini"]).default("local"),
  model: z.string().max(80).default(""),
  temperature: z.number().min(0).max(1).default(0.4),
  maxOutputTokens: z.number().int().min(128).max(8192).default(2500),
  monthlyBudgetUsd: z.number().min(0).max(1000).default(5),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

export const DEFAULT_MODELS: Record<AIConfig["provider"], string> = {
  local: "local-interpreter-v1",
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
};

export async function getAIConfig(): Promise<AIConfig> {
  const setting = await prisma.appSetting.findUnique({ where: { key: "ai" } }).catch(() => null);
  let stored: Partial<AIConfig> = {};
  if (setting) {
    try {
      stored = AIConfigSchema.partial().parse(JSON.parse(setting.value));
    } catch {
      stored = {};
    }
  }
  const provider = stored.provider ?? env.AI_PROVIDER;
  return AIConfigSchema.parse({
    provider,
    model: stored.model || env.AI_MODEL || DEFAULT_MODELS[provider],
    temperature: stored.temperature ?? 0.4,
    maxOutputTokens: stored.maxOutputTokens ?? env.AI_MAX_OUTPUT_TOKENS,
    monthlyBudgetUsd: stored.monthlyBudgetUsd ?? env.AI_MONTHLY_BUDGET_USD,
  });
}

export function createProvider(config: AIConfig): AIProvider {
  if (config.provider === "openai") {
    return new OpenAIProvider(env.OPENAI_API_KEY, config.model);
  }
  if (config.provider === "gemini") {
    return new GeminiProvider(env.GEMINI_API_KEY, config.model);
  }
  return new LocalInterpretationProvider();
}

export async function getProvider(): Promise<{ provider: AIProvider; config: AIConfig }> {
  const config = await getAIConfig();
  const provider = createProvider(config);
  if (!(await provider.available())) {
    throw new AIProviderError(
      "PROVIDER_NOT_CONFIGURED",
      `The configured AI provider (${config.provider}) has no server-side credentials. Add them to the environment or switch to the local interpreter in Admin → AI settings.`,
      false,
    );
  }
  return { provider, config };
}

async function budgetExceeded(config: AIConfig): Promise<boolean> {
  if (config.provider === "local") return false;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const usage = await prisma.aIUsage.aggregate({
    _sum: { costUsd: true },
    where: { createdAt: { gte: start } },
  });
  return (usage._sum.costUsd ?? 0) >= config.monthlyBudgetUsd;
}

async function recordUsage(input: {
  provider: string;
  model: string;
  task: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  userId?: string;
  readingId?: string;
  success: boolean;
  errorCode?: string;
}): Promise<void> {
  try {
    await prisma.aIUsage.create({
      data: {
        userId: input.userId ?? null,
        readingId: input.readingId ?? null,
        task: input.task,
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costUsd: input.costUsd,
        latencyMs: input.latencyMs,
        success: input.success,
        errorCode: input.errorCode,
      },
    });
  } catch {
    console.error("[ai] usage persistence failed");
  }
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).join("\n");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(extractText).join("\n");
  }
  return "";
}

export async function runSafetyValidation(text: string): Promise<SafetyValidation> {
  const provider = new SafetyLocal();
  const result = await provider.generateStructuredOutput({
    task: "SAFETY_VALIDATION",
    schema: SafetyValidationSchema,
    schemaName: "safety_validation",
    userPrompt: PROMPTS.safety.build(text, "en"),
    promptVersion: PROMPTS.safety.version,
    context: { text },
  });
  return result.data;
}

export interface GenerateOptions {
  userId?: string;
  readingId?: string;
  promptKey: PromptKey;
  payload: string;
  language: string;
  context?: unknown;
  images?: AIRequest<unknown>["images"];
  schema: z.ZodType<unknown>;
  schemaName: string;
  temperature?: number;
}

export async function generateFromPrompt(options: GenerateOptions): Promise<{
  data: unknown;
  provider: string;
  model: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
}> {
  const { provider, config } = await getProvider();
  if (await budgetExceeded(config)) {
    throw new AIProviderError("BUDGET_EXCEEDED", "The monthly AI budget has been reached. Contact the administrator.", false);
  }
  const prompt = PROMPTS[options.promptKey];
  const started = Date.now();
  try {
    const result = await provider.generateStructuredOutput({
      task: prompt.task,
      schema: options.schema,
      schemaName: options.schemaName,
      systemPrompt: BASE_SYSTEM_INSTRUCTION,
      userPrompt: prompt.build(options.payload, options.language),
      promptVersion: prompt.version,
      temperature: options.temperature ?? config.temperature,
      maxTokens: config.maxOutputTokens,
      images: options.images,
      context: options.context,
      userId: options.userId,
      readingId: options.readingId,
    });

    const narratives = extractText(result.data);
    const safety = await runSafetyValidation(narratives);
    if (!safety.safe) {
      throw new AIProviderError(
        "SAFETY_VIOLATION",
        `Generated content failed safety validation: ${safety.issues.join(", ")}`,
        false,
      );
    }

    await recordUsage({
      provider: result.usage.provider,
      model: result.usage.model,
      task: prompt.task,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
      latencyMs: result.usage.latencyMs,
      userId: options.userId,
      readingId: options.readingId,
      success: true,
    });
    return {
      data: result.data,
      provider: result.provider,
      model: provider.model,
      promptVersion: result.promptVersion,
      usage: result.usage,
    };
  } catch (error) {
    const code = error instanceof AIProviderError ? error.code : "AI_ERROR";
    await recordUsage({
      provider: config.provider,
      model: provider.model,
      task: prompt.task,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - started,
      userId: options.userId,
      readingId: options.readingId,
      success: false,
      errorCode: code,
    });
    throw error;
  }
}

export async function streamAnswer(input: AIChatRequest): Promise<AsyncIterable<string>> {
  const { provider, config } = await getProvider();
  if (await budgetExceeded(config)) {
    throw new AIProviderError("BUDGET_EXCEEDED", "The monthly AI budget has been reached.", false);
  }
  return provider.generateStreamingResponse({
    ...input,
    systemPrompt: BASE_SYSTEM_INSTRUCTION,
    temperature: input.temperature ?? config.temperature,
    maxTokens: config.maxOutputTokens,
  });
}

export async function providerStatus(): Promise<{
  config: AIConfig;
  available: boolean;
  reason?: string;
}> {
  const config = await getAIConfig();
  const provider = createProvider(config);
  const available = await provider.available();
  return {
    config,
    available,
    reason: available ? undefined : "Server-side credentials are not configured.",
  };
}

export { estimateCost };
