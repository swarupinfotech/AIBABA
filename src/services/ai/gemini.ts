import type {
  AIProvider,
  AIChatRequest,
  AIRequest,
  AIResult,
} from "@/services/ai/types";
import { AIProviderError, estimateCost } from "@/services/ai/types";
import { env } from "@/lib/env";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fence ? fence[1] : trimmed;
}

export class GeminiProvider implements AIProvider {
  name = "gemini";
  model: string;
  private apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async available(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  private endpoint(stream: boolean): string {
    const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:${action}`;
  }

  async generateStructuredOutput<T>(input: AIRequest<T>): Promise<AIResult<T>> {
    const started = Date.now();
    if (!this.apiKey) throw new AIProviderError("PROVIDER_NOT_CONFIGURED", "Gemini is not configured.");
    const parts: Array<Record<string, unknown>> = [{ text: input.userPrompt }];
    for (const image of input.images ?? []) {
      parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
    }
    const body = {
      systemInstruction: {
        parts: [{ text: input.systemPrompt ?? "Return only JSON matching the requested schema." }],
      },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: input.temperature ?? 0.4,
        maxOutputTokens: input.maxTokens ?? env.AI_MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    };

    let response: Response;
    try {
      response = await fetch(`${this.endpoint(false)}&key=${encodeURIComponent(this.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      });
    } catch {
      throw new AIProviderError("PROVIDER_UNAVAILABLE", "The AI service could not be reached.", true);
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
      throw new AIProviderError(
        response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR",
        payload?.error?.message?.slice(0, 300) ?? `AI provider returned ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    }
    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new AIProviderError("EMPTY_RESPONSE", "The AI service returned no content.", true);
    let json: unknown;
    try {
      json = JSON.parse(stripFences(text));
    } catch {
      throw new AIProviderError("INVALID_JSON", "The AI service returned malformed structured output.", true);
    }
    const data = input.schema.parse(json);
    const inputTokens = payload.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;
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
    if (!this.apiKey) throw new AIProviderError("PROVIDER_NOT_CONFIGURED", "Gemini is not configured.");
    const response = await fetch(`${this.endpoint(true)}&key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt ?? "You are AIBABA." }] },
        contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: input.maxTokens ?? env.AI_MAX_OUTPUT_TOKENS },
      }),
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });
    if (!response.ok || !response.body) {
      throw new AIProviderError("PROVIDER_UNAVAILABLE", "The AI stream could not be started.", true);
    }
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
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim()) as GeminiResponse;
          const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
          if (text) yield text;
        } catch {
          // Ignore malformed fragments; the final saved answer is safety-checked.
        }
      }
    }
  }
}
