import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDialContextWindow } from "@/lib/dial";

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CallUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  contextMessages: number;
  contextWindowUsed: number | null;
  contextWindowLimit: number;
  contextWindowPct: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getCallUsage(
  response: {
    usage_metadata?: unknown;
    response_metadata?: unknown;
  },
  contextMessages: number,
): CallUsage {
  const usageMeta = asRecord(response.usage_metadata);
  const tokenUsage = asRecord(asRecord(response.response_metadata)?.tokenUsage);
  const inputTokens =
    asNumber(usageMeta?.input_tokens) ?? asNumber(tokenUsage?.promptTokens);
  const outputTokens =
    asNumber(usageMeta?.output_tokens) ??
    asNumber(tokenUsage?.completionTokens);
  const totalTokens =
    asNumber(usageMeta?.total_tokens) ?? asNumber(tokenUsage?.totalTokens);
  const contextWindowLimit = getDialContextWindow();
  const contextWindowUsed = inputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    contextMessages,
    contextWindowUsed,
    contextWindowLimit,
    contextWindowPct:
      contextWindowUsed === null
        ? null
        : Math.round((contextWindowUsed / contextWindowLimit) * 10000) / 100,
  };
}

export function toLangChainMessages(messages: AgentMessage[]) {
  return [
    new SystemMessage(
      "You are a helpful chat agent. Use the conversation history and answer the latest user message.",
    ),
    ...messages
      .filter((message) => message.content.trim())
      .map((message) =>
        message.role === "user"
          ? new HumanMessage(message.content.trim())
          : new AIMessage(message.content.trim()),
      ),
  ];
}
