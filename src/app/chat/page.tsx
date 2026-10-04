"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type CallUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  contextMessages: number;
  contextWindowUsed: number | null;
  contextWindowLimit: number;
  contextWindowPct: number | null;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  usage?: CallUsage;
};

const STARTERS = [
  "Summarize what you can help with.",
  "Explain context windows in one paragraph.",
  "Give me 3 prompt ideas for this agent.",
];

function formatTokens(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function formatWindow(usage: CallUsage) {
  const used = formatTokens(usage.contextWindowUsed);
  const limit = formatTokens(usage.contextWindowLimit);
  const pct =
    usage.contextWindowPct === null ? "—" : `${usage.contextWindowPct}%`;
  return `win ${used}/${limit} (${pct})`;
}

function UsageChip({ usage }: { usage: CallUsage }) {
  return (
    <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[#3d4a30] bg-[#10140f] px-2.5 py-1 font-mono text-[10px] tracking-wide text-[#9cb36a]">
      <span>ctx {usage.contextMessages} msgs</span>
      <span className="text-[#5d6a42]">·</span>
      <span>{formatWindow(usage)}</span>
      <span className="text-[#5d6a42]">·</span>
      <span>in {formatTokens(usage.inputTokens)}</span>
      <span className="text-[#5d6a42]">·</span>
      <span>out {formatTokens(usage.outputTokens)}</span>
      <span className="text-[#5d6a42]">·</span>
      <span>tot {formatTokens(usage.totalTokens)}</span>
    </p>
  );
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [showJump, setShowJump] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  function resizeComposer() {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }

  function scrollToBottom(smooth = false) {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    stickToBottom.current = true;
    setShowJump(false);
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [input]);

  useEffect(() => {
    if (stickToBottom.current) {
      scrollToBottom();
    }
  }, [messages, loading, error]);

  function onThreadScroll() {
    const node = scrollerRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const nearBottom = distance < 72;
    stickToBottom.current = nearBottom;
    setShowJump(!nearBottom && messages.length > 0);
  }

  async function sendHistory(history: ChatMessage[]) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setLoading(true);
    stickToBottom.current = true;

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
        usage?: CallUsage;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content: data.text ?? "",
          usage: data.usage,
        },
      ]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Generation stopped.");
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function onSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    requestAnimationFrame(resizeComposer);
    await sendHistory(nextMessages);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void onSubmit();
    }
    if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  function retryLast() {
    if (loading || messages.length === 0) return;
    void sendHistory(messages);
  }

  function newThread() {
    if (loading) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setError("");
    setInput("");
    setShowJump(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(""), 1500);
    } catch {
      setError("Could not copy message.");
    }
  }

  const turnCount = messages.filter((message) => message.role === "user").length;

  return (
    <main className="flex h-dvh flex-col bg-[#10140f] text-[#e8ecd4]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#2c3524] px-5 py-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-[#9cb36a] uppercase">
            Agent desk
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Chat</h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden font-mono text-[11px] text-[#7d8a5e] sm:block">
            {turnCount === 0 ? "No turns yet" : `${turnCount} turn${turnCount === 1 ? "" : "s"}`}
          </p>
          <button
            type="button"
            onClick={newThread}
            disabled={messages.length === 0 && !error}
            className="rounded-full border border-[#3d4a30] px-3 py-1.5 font-mono text-xs text-[#d4e89a] disabled:opacity-40"
          >
            New thread
          </button>
          <a
            href="/"
            className="font-mono text-xs text-[#9cb36a] underline-offset-4 hover:underline"
          >
            Basic LLM
          </a>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={onThreadScroll}
          className="h-full overflow-y-auto px-5 py-6"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {messages.length === 0 && !loading ? (
              <div className="mt-10 rounded-2xl border border-dashed border-[#3d4a30] bg-[#171c14] p-8">
                <p className="text-lg font-medium">Start a thread with the agent</p>
                <p className="mt-2 text-sm text-[#b7c09a]">
                  Enter sends. Shift+Enter adds a line. History goes with every turn.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => {
                        setInput(starter);
                        inputRef.current?.focus();
                      }}
                      className="rounded-full border border-[#3d4a30] bg-[#10140f] px-3 py-1.5 text-left text-xs text-[#d4e89a] hover:border-[#9cb36a]"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#d4e89a] px-4 py-3 text-[#1a220f]"
                    : "mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-[#334028] bg-[#1a2116] px-4 py-3"
                }
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase opacity-70">
                    {message.role === "user" ? "You" : "Agent"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyMessage(message)}
                    className="font-mono text-[10px] uppercase tracking-wide opacity-60 hover:opacity-100"
                  >
                    {copiedId === message.id ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                {message.role === "assistant" && message.usage ? (
                  <UsageChip usage={message.usage} />
                ) : null}
              </article>
            ))}

            {loading ? (
              <article className="mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-[#334028] bg-[#1a2116] px-4 py-3">
                <p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-[#9cb36a] uppercase">
                  Agent
                </p>
                <p className="font-mono text-xs tracking-[0.16em] text-[#9cb36a] uppercase">
                  Thinking…
                </p>
              </article>
            ) : null}

            {error ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={retryLast}
                  disabled={loading || messages.length === 0}
                  className="rounded-full border border-red-200/30 px-3 py-1 font-mono text-[11px] uppercase tracking-wide disabled:opacity-40"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {showJump ? (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-[#3d4a30] bg-[#141910] px-3 py-1.5 font-mono text-[11px] text-[#d4e89a] shadow-lg"
          >
            Jump to latest
          </button>
        ) : null}
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="shrink-0 border-t border-[#2c3524] bg-[#141910] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message the agent…"
            className="max-h-[200px] min-h-[48px] flex-1 resize-none overflow-y-auto rounded-xl border border-[#3d4a30] bg-[#10140f] px-3 py-3 text-sm outline-none placeholder:text-[#6f7a58] focus:border-[#9cb36a]"
          />
          {loading ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="h-11 rounded-full bg-[#5a2d2d] px-5 text-sm font-semibold text-[#f3d4d4]"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-11 rounded-full bg-[#d4e89a] px-5 text-sm font-semibold text-[#1a220f] disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
