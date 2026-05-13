# ember-agent

A standalone, Dockerizable AI agent service. One agent = one directory. OpenClaw-compatible skills, any OpenAI-compatible LLM, Telegram and a built-in web chat out of the box. Drop a config + a SOUL, ship an agent.

## Quickstart

```bash
cd agent && pnpm install
cp .env.example .env   # then fill in LLM_API_KEY
pnpm dev               # boots the example agent at examples/default-agent
```

Open `http://localhost:7777/chat` and talk to it.

## SOUL.md vs AGENTS.md

Both live inside the agent directory and are concatenated into the system prompt in this order:

- **`SOUL.md`** — voice and personality. Tone, vocabulary, banned phrases, humor rules. What the agent *sounds like*.
- **`AGENTS.md`** — operating rules. What it must/must not do, when to confirm, sourcing rules, refusal policy. What the agent *does*.

Keep each tight. Two short files beat one long one.

## LLM providers

Works with any OpenAI-compatible chat-completions endpoint. Swap by editing `.env` — no code changes:

| Provider     | `LLM_BASE_URL`                          |
| ------------ | --------------------------------------- |
| OpenAI       | `https://api.openai.com/v1`             |
| OpenRouter   | `https://openrouter.ai/api/v1`          |
| 0G Compute   | `https://router-api.0g.ai/v1`           |
| Local vLLM   | `http://localhost:8000/v1`              |

Set `LLM_API_KEY` and `LLM_MODEL` accordingly. Same pattern for `EMBEDDINGS_*`.

## Telegram

1. Talk to [@BotFather](https://t.me/BotFather), `/newbot`, grab the token.
2. Set `TELEGRAM_BOT_TOKEN=<token>` in `.env`.
3. In `agent.config.json`, flip `channels.telegram.enabled` to `true`.
4. Restart. DM the bot or `@mention` it in a group.

DM access is controlled by `dmPolicy` (`open` | `allowlist` | `disabled`). Groups require a mention by default.

## Web chat

Served at `/chat` from `public/chat.html`. It's a single static file — edit it, theme it, or replace it entirely. The backend exposes:

- `GET /chat` — the HTML page
- `POST /chat/message` — submit a message
- `GET /chat/stream/:id` — SSE stream of the reply

## Skills

OpenClaw-compatible. A skill is a directory under `skills/<name>/` with a `SKILL.md`.

- **Filesystem**: drop a directory under `<agent>/skills/<name>/SKILL.md`. Hot-reloads.
- **Via API**: `POST /skills/install { "source": "agentskill.sh", "slug": "<owner>/<name>" }`. Other sources: `clawhub`, `url`.
- **Remove**: `DELETE /skills/<name>`.

Every install is run through the security scanner first. Findings are surfaced; criticals block.

## MCP servers

Edit `mcp.json` or call `POST /mcp/servers { id, command, args, env }`. Child processes are spawned on boot and their tools are merged into the registry.

## Evolution mode

In `agent.config.json` under `evolution.mode`:

- `off` — disabled.
- `suggest` *(default)* — discovers candidate skills and posts them to the control channel for review.
- `auto-safe` — auto-install if `securityScore >= 80` *and* the skill is pure-prompt (no code).
- `auto-all` — auto-install if `securityScore >= 50` and the scanner sees no critical findings.

> **Warning:** `auto-all` carries supply-chain risk. Public skills can prompt-inject even after scanning. Default to `suggest` unless you understand the risk.

## Admin API

No auth — assume network isolation. BonFire adds auth at its layer.

| Method | Path                          | Purpose                       |
| ------ | ----------------------------- | ----------------------------- |
| GET    | `/health`                     | health + status               |
| GET    | `/skills`                     | list installed skills         |
| POST   | `/skills/install`             | install from source           |
| DELETE | `/skills/:name`               | remove a skill                |
| GET    | `/skills/discover`            | evolution discovery feed      |
| POST   | `/mcp/servers`                | register an MCP server        |
| DELETE | `/mcp/servers/:id`            | remove an MCP server          |
| GET    | `/config`                     | read merged config            |
| PATCH  | `/config`                     | mutate config                 |
| POST   | `/channels/telegram`          | runtime telegram control      |
| GET    | `/events`                     | SSE event stream              |
| GET    | `/chat`                       | built-in web chat UI          |
| POST   | `/chat/message`               | submit a chat message         |
| GET    | `/chat/stream/:id`            | SSE reply stream              |

## Project layout

```
agent/
  src/
    api/         # Hono admin + chat routes
    channels/    # telegram, web
    config/      # zod schema + loader (SOUL/AGENTS)
    evolution/   # discover, score, loop
    memory/      # SQLite vector store
    runtime/     # session manager + prompt builder
    skills/      # loader, scanner, installer, registries
    tools/       # built-ins + MCP client + registry
    util/        # logger, path guard
    index.ts     # entrypoint
  examples/
    default-agent/   # mounted at /agent by docker
  public/
    chat.html        # built-in web chat
  docker/
    Dockerfile
    docker-compose.yml
  test/
```

## Docker

```bash
cd docker
docker compose up --build
```

Mounts `examples/default-agent` at `/agent` and exposes `:7777`.
