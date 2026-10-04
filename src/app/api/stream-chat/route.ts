import { getCallUsage, toLangChainMessages, type AgentMessage } from "@/lib/agent";
import { createDialChatModel } from "@/lib/dial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeEvent(payload: Record<string, unknown>) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: Request) {
  const { messages } = (await request.json()) as {
    messages?: AgentMessage[];
  };

  const history = messages ?? [];
  const lastUser = [...history]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim());

  if (!lastUser) {
    return Response.json({ error: "A user message is required." }, { status: 400 });
  }

  const langchainMessages = toLangChainMessages(history);
  const model = createDialChatModel({ streaming: true });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(encodeEvent(payload)));
      };

      try {
        let lastChunk: {
          usage_metadata?: unknown;
          response_metadata?: unknown;
        } | null = null;

        for await (const chunk of await model.stream(langchainMessages, {
          signal: request.signal,
        })) {
          if (request.signal.aborted) {
            break;
          }

          lastChunk = chunk;
          const delta =
            typeof chunk.content === "string"
              ? chunk.content
              : Array.isArray(chunk.content)
                ? chunk.content
                    .map((part) =>
                      typeof part === "string"
                        ? part
                        : part && typeof part === "object" && "text" in part
                          ? String(part.text ?? "")
                          : "",
                    )
                    .join("")
                : "";

          if (delta) {
            send({ delta });
          }
        }

        if (lastChunk) {
          send({ usage: getCallUsage(lastChunk, langchainMessages.length) });
        }

        send({ done: true });
      } catch (error) {
        if (request.signal.aborted) {
          send({ error: "Generation stopped." });
        } else {
          send({
            error: error instanceof Error ? error.message : "Stream failed.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
