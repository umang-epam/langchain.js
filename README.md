# LangChain.js + EPAM DIAL

Next.js app that calls EPAM DIAL through LangChain.js (`AzureChatOpenAI`).

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local`:

| Variable | Use |
| --- | --- |
| `DIAL_URL` | DIAL Core base URL, no trailing slash |
| `DIAL_API_KEY` | DIAL API key |
| `DIAL_DEPLOYMENT` | Model or app id in DIAL |
| `DIAL_API_VERSION` | Optional. Defaults to `2024-02-01` |

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Use |
| --- | --- |
| [`/`](http://localhost:3000/) | Single-shot prompt. Posts `{ prompt }` to `/api/chat` and shows one completion. |
| [`/chat`](http://localhost:3000/chat) | Buffered agent thread. Sends full history to `/api/agent` and waits for the full reply, plus usage chips. |
| [`/stream-chat`](http://localhost:3000/stream-chat) | Streaming agent thread. Posts history to `/api/stream-chat` and appends LangChain tokens as they arrive. |

## API routes

| Route | Method | Use |
| --- | --- | --- |
| `/api/chat` | `POST` | Basic LLM call. Body: `{ prompt }`. Returns `{ text }`. Uses a system + human message, no history. |
| `/api/agent` | `POST` | Buffered chat turn. Body: `{ messages: [{ role, content }] }`. Maps history to LangChain `SystemMessage` / `HumanMessage` / `AIMessage`, then `model.invoke()`. Returns `{ text, usage }`. |
| `/api/stream-chat` | `POST` | Streaming chat turn. Same body as `/api/agent`. Uses `model.stream()` and SSE: `{ delta }`, then `{ usage }`, then `{ done: true }`. |

### Usage payload

`usage` on agent and stream responses:

- `contextMessages` — LangChain messages sent this turn
- `contextWindowUsed` / `contextWindowLimit` / `contextWindowPct` — prompt tokens vs the model default window
- `inputTokens` / `outputTokens` / `totalTokens` — DIAL token counts

## Shared code

- [`src/lib/dial.ts`](src/lib/dial.ts) — DIAL `AzureChatOpenAI` client
- [`src/lib/agent.ts`](src/lib/agent.ts) — history → LangChain messages and usage helpers
