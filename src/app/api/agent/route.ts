import { NextResponse } from "next/server";
import { getCallUsage, toLangChainMessages, type AgentMessage } from "@/lib/agent";
import { createDialChatModel } from "@/lib/dial";

export type { AgentMessage, CallUsage } from "@/lib/agent";

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as {
      messages?: AgentMessage[];
    };

    const history = messages ?? [];
    const lastUser = [...history]
      .reverse()
      .find((message) => message.role === "user" && message.content.trim());

    if (!lastUser) {
      return NextResponse.json(
        { error: "A user message is required." },
        { status: 400 },
      );
    }

    const langchainMessages = toLangChainMessages(history);
    const model = createDialChatModel();
    const response = await model.invoke(langchainMessages);

    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return NextResponse.json({
      text,
      usage: getCallUsage(response, langchainMessages.length),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent call failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
