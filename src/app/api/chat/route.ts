import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { createDialChatModel } from "@/lib/dial";

export async function POST(request: Request) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 },
      );
    }

    const model = createDialChatModel();
    const response = await model.invoke([
      new SystemMessage("You are a concise assistant."),
      new HumanMessage(prompt.trim()),
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM call failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
