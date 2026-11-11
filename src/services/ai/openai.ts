import { z } from "zod";
import type {
  AIProvider,
  AIChatRequest,
  AIRequest,
  AIResult,
} from "@/services/ai/types";
import { AIProviderError, estimateCost } from "@/services/ai/types";
import { env } from "@/lib/env";

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string | null }; delta?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string };
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fence ? fence[1] : trimmed;
}

async function backoff(attempt: number): Promise<void> {
  const delay = 400 * 2 ** attempt + Math.floor(Math.random() * 200);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export class OpenAIProvider implements AIProvider {
  name = "openai";
  model: string;
  private apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async available(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  private async call(body: Record<string, unknown>, stream = false): Promise<Response> {
    if (!this.apiKey) throw new AIProviderError("PROVIDER_NOT_CONFIGURED", "OpenAI is not configured.", false);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ ...body, model: this.model, stream }),
          signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
        });
        if (response.ok) return response;
        if (response.status === 429 || response.status >= 500) {
          if (attempt < 2) {
            await backoff(attempt);
            continue;
          }
        }
        const payload = (await response.json().catch(() => null)) as OpenAIResponse | null;
        throw new AIProviderError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR",
          payload?.error?.message?.slice(0, 300) ?? `AI provider returned ${response.status}.`,
          response.status === 429 || response.status >= 500,
        );
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        if (attempt >= 2) {
          throw new AIProviderError(
            "PROVIDER_UNAVAILABLE",
            "The AI service could not be reached. Please try again later.",
            true,
          );
        }
        await backoff(attempt);
      }
    }
    throw new AIProviderError("PROVIDER_UNAVAILABLE", "The AI service is unavailable.", true);
  }

  async generateStructuredOutput<T>(input: AIRequest<T>): Promise<AIResult<T>> {
    const started = Date.now();
    const jsonSchema = z.toJSONSchema(input.schema, { target: "draft-2020-12" });
    delete (jsonSchema as Record<string, unknown>).$schema;
    const system = input.systemPrompt ?? "Return only valid JSON matching the requested schema.";
    const content: Array<Record<string, unknown>> = [];
    if (input.images?.length) {
      content.push({ type: "text", text: input.userPrompt });
      for (const image of input.images) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
        });
      }
    }

    const response = await this.call({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: input.images?.length ? content : input.userPrompt,
        },
      ],
      temperature: input.temperature ?? 0.4,
      max_completion_tokens: input.maxTokens ?? env.AI_MAX_OUTPUT_TOKENS,
      response_format: {
        type: "json_schema",
        json_schema: { name: input.schemaName, strict: false, schema: jsonSchema },
      },
    });
    const payload = (await response.json()) as OpenAIResponse;
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      throw new AIProviderError("EMPTY_RESPONSE", "The AI service returned no content.", true);
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripFences(text));
    } catch {
      throw new AIProviderError("INVALID_JSON", "The AI service returned malformed structured output.", true);
    }
    const data = input.schema.parse(parsedJson);
    const inputTokens = payload.usage?.prompt_tokens ?? 0;
    const outputTokens = payload.usage?.completion_tokens ?? 0;
    return {
      data,
      provider: this.name,
      promptVersion: input.promptVersion,
      usage: {
        provider: this.name,
        model: this.model,
        inputTokens,
        outputTokens,
        costUsd: estimateCost(this.model, inputTokens, outputTokens),
        latencyMs: Date.now() - started,
      },
    };
  }

  async *generateStreamingResponse(input: AIChatRequest): AsyncIterable<string> {
    const response = await this.call(
      {
        messages: [
          { role: "system", content: input.systemPrompt ?? "You are AIBABA." },
          { role: "user", content: input.userPrompt },
        ],
        temperature: input.temperature ?? 0.5,
        max_completion_tokens: input.maxTokens ?? env.AI_MAX_OUTPUT_TOKENS,
      },
      true,
    );
    if (!response.body) throw new AIProviderError("EMPTY_RESPONSE", "The AI stream was empty.", true);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data) as OpenAIResponse;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Ignore keep-alive or malformed SSE fragments; the final text is validated separately.
        }
      }
    }
  }
}
