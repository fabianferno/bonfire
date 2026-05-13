# BonFire — Product Requirements Document

> **Status:** Draft v0.1
> **Owner:** TBD
> **Last updated:** 2026-05-13

---

## 1. One-line summary

BonFire is a Discord-style workspace for orchestrating teams of AI agents — where every server is a wallet-funded "agent guild," every channel is a workflow, and every agent is an INFT (ERC-7857) running on verifiable 0G compute.

---

## 2. Vision & problem

### The problem
Today's agent landscape is split between two bad options:

1. **Single-agent chat UIs** (ChatGPT, Claude.ai) — great UX, but no native concept of multi-agent teams, no shared workspace, no economic primitives, no ownership of the agent.
2. **Agent frameworks** (LangChain, CrewAI, etc.) — powerful, but require code, have no end-user UX, and treat agents as ephemeral processes rather than ownable, transferable assets.

Meanwhile, the most familiar collaboration UX in the world — Discord — is already the way humans organize around shared context: servers for communities, channels for topics, voice for synchronous work, sidebars for presence. **No one has applied that UX to agent teams.**

### The vision
**BonFire** is the cognitive backbone and orchestration surface for autonomous intelligence: a place where you spin up a server, fund it with `0G`, invite specialist agents from a marketplace (each one an INFT you can own and transfer), and put them to work in text and voice channels. Inference runs in TEEs. State lives on 0G Storage. Ownership lives on 0G Chain.

### Why now
- 0G mainnet ("Aristotle") is live since Sept 2025 with native AI primitives (Storage, Compute, DA, Chain).
- ERC-7857 (INFT) gives us a real standard for ownable, transferable, encrypted-metadata agents.
- 0G Compute's Sealed Inference (Intel TDX + NVIDIA H100/H200 TEE, OpenAI-compatible API) makes verifiable agent execution practical.
- LiveKit's agent framework makes real-time STT→LLM→TTS pipelines a configuration problem, not a research problem.
- Privy makes wallet-based onboarding feel like Web2.

The pieces exist. Nobody has assembled them into a product that an everyday user can navigate.

---

## 3. Core concepts

| Concept | What it is | Discord analogy |
|---|---|---|
| **Server (Workspace)** | A funded, multi-agent environment with its own balance, members, channels, and invited agents. | Discord server / guild |
| **Channel** | A text or voice space scoped to a workflow. Channels can have a default agent, a sub-team, or be open to all server agents. | Discord text/voice channel |
| **Agent** | An INFT (ERC-7857) with private metadata (model, weights/adapter pointer, system prompt, skills, memory). Owned by a user, *invited* into a server. | A bot, but you actually own it |
| **Skill** | A capability file (system prompt + tools + few-shot + config) that an agent can mount. Surfaced in the UI as Discord-style commands and capability cards. | Slash commands, but composable |
| **Server Credits** | A single ledger of `0G` (or routed equivalents) that funds *all* agent operations inside one server. | Discord Boosts, but actually pays for compute |
| **Marketplace** | A discovery surface for INFT agents — browse, preview, license/buy, then invite into your server. | Discord bot directory + OpenSea, fused |

---

## 4. Target users

- **Power knowledge workers** running personal agent teams (research, writing, code review, scheduling) and wanting one home for them.
- **Small teams** that want a shared agent workspace instead of forwarding ChatGPT links.
- **Agent builders** who want a distribution surface for INFTs they create, with on-chain royalties.
- **Crypto-native users** who already hold `0G` and want a real product to spend it on.

Out of scope (v1): enterprise SSO, on-prem deployments, regulated industries.

---

## 5. Key user journeys

### 5.1 First-time user
1. Lands on bonfire.xyz → clicks **Login with Privy** (email, Google, Apple, or wallet).
2. Privy provisions an embedded wallet configured for 0G Chain (chain ID `16661`).
3. User funds the wallet (Privy's fiat on-ramp or bridge).
4. Onboarding wizard offers: *"Create your first BonFire"* (server) with 2–3 starter agent templates pre-suggested.
5. User enters a server, sees `#general`, talks to the default agent, gets the AHA.

### 5.2 Building an agent guild
1. User creates server **"Research Lab"** → funds it with 50 `0G`.
2. Opens the **Marketplace** sidebar, filters by category (Research, Code, Voice, Finance).
3. Invites: `@perplexity-style-researcher`, `@arxiv-summarizer`, `@critic-claude`.
4. Creates channels: `#literature-review` (text), `#voice-debrief` (voice), `#critique` (text).
5. In `#literature-review`, types `/research "latent space steering 2025"` — the researcher runs, posts results, the critic agent auto-replies with pushback.
6. Joins `#voice-debrief`, speaks to the agent via STT→LLM→TTS.

### 5.3 Voice-first workflow
1. User joins a voice channel — LiveKit room spins up, the channel's bound agent joins as a participant.
2. STT (e.g., Whisper via 0G Compute) → LLM (agent's configured model) → TTS streams audio back.
3. Transcripts surface in the channel's text panel in real time. Costs draw from server balance.

### 5.4 Agent transfer / sale
1. User opens an agent they own → **Transfer** or **List on marketplace**.
2. ERC-7857 oracle re-encrypts the agent's private metadata for the new owner.
3. Original creator earns royalties on resale (ERC-7857 native).

---

## 6. Functional requirements

### 6.1 Authentication & identity
- **Privy** as sole auth provider. Supports email, social (Google/Apple/Discord/X), passkey, and "Connect Wallet" for existing 0G holders.
- Privy is configured with 0G mainnet as a custom EVM chain via `viem.defineChain` (chainId 16661, RPC `https://evmrpc.0g.ai`).
- Every user gets a Privy embedded wallet on 0G; existing wallets can be linked.
- Optional: smart wallet (ERC-4337) with gas sponsorship for first-time UX (Privy paymaster).

### 6.2 Servers (workspaces)
- Create / rename / delete servers.
- Per-server: name, icon, description, member list, role config, agent roster, credit balance, channel tree.
- **Roles**: Owner, Admin, Member, Guest. Permissions for: invite humans, invite agents, top up balance, create channels, configure agents.
- **Server balance**: a smart contract escrow on 0G Chain holding `0G` for the server. Funded by any member; spendable by approved agents; auditable on-chain.
- **Spend limits**: per-channel and per-agent caps (e.g. `#research` can spend ≤ 5 `0G`/day).
- **Audit log**: every agent invocation logged with cost, model used, TEE attestation hash, storage CID.

### 6.3 Channels
- **Text channels**: Discord-grade UX — messages, threads, replies, reactions, mentions (`@agent`), pinned messages, attachments.
- **Voice channels**: backed by LiveKit rooms. Push-to-talk + open-mic modes. Krisp noise cancellation, Silero VAD, multilingual turn detection.
- **Channel binding**: each channel can have one *default agent* (auto-responds), or be an open arena where any `@mention` summons.
- **Workflow channels**: pre-built templates (Research, Code Review, Sales Outreach, Customer Support) that ship with a recommended agent bundle and channel layout.
- **Slash commands**: `/help`, `/balance`, `/spend`, `/agents`, plus per-agent commands surfaced from their skill files.
- **Attachments**: files dropped into a channel are pinned to **0G Storage**, with CID stored in the message metadata.

### 6.4 Agents

#### 6.4.1 Agent identity & ownership
- Every agent is an **ERC-7857 INFT** minted on 0G Chain.
- Private metadata stored on 0G Storage, encrypted with the owner's key. Public metadata (name, avatar, description, category, rate card) on-chain.
- Owners can: transfer, list, lend, or grant server-scoped usage rights.

#### 6.4.2 Agent runtime
- Inference via **0G Compute Network** through the OpenAI-compatible router (`router-api.0g.ai/v1`) using `@0glabs/0g-serving-broker`.
- TEE-verified by default ("Sealed Inference" — Intel TDX CPU + NVIDIA H100/H200 GPU enclave). Remote Attestation reports surfaced in the agent profile.
- Agents may declare a preferred model (e.g. GLM-5, Qwen3.6-Plus, DeepSeek-V3); server admins can override.
- Per-agent **rate card**: input + output token price in `0G`, voice cost per minute. Drawn from server balance on each call.

#### 6.4.3 Presence (the Discord touch)
- Right sidebar lists all server agents.
- **Online** = agent's runtime worker is healthy and the server has > minimum balance to invoke it.
- **Busy** = currently executing a task.
- **Idle** = configured but not actively listening.
- **Offline** = worker down or insufficient balance.

#### 6.4.4 Skills
- Agents mount **Skills** (analogous to the Claude `SKILL.md` pattern): a folder with `SKILL.md`, optional tool definitions, prompt fragments, examples.
- Skills surface in the UI as:
  - Capability cards on the agent profile.
  - Slash commands inside channels (`/research`, `/summarize`, `/write-pr`).
  - Discoverable hints in the message composer.
- Skills are versioned and can be installed/uninstalled per agent without re-minting the INFT (the active skill set is in the dynamic metadata that ERC-7857 supports).

#### 6.4.5 Memory
- Per-agent long-term memory: vector store + structured logs persisted on **0G Storage**.
- Per-channel context window with configurable retention.
- Memory is encrypted and scoped — an agent invited into Server A cannot read its memories from Server B unless the owner explicitly allows cross-server memory.

### 6.5 Orchestration

This is the substantive bet beyond "Discord skin for agents."

- **Mention chains**: `@critic` can be configured to auto-trigger after `@writer` finishes, building DAGs from mentions.
- **Channel as workflow**: a `#deal-flow` channel could route: incoming-lead → enrichment-agent → analyst-agent → drafter-agent → human review. Configured visually in a "channel pipeline" panel.
- **Conductor agent (optional, v1.5)**: a special agent role that receives a goal and decomposes/delegates across the server's other agents. This is the "OpenClaw-style orchestrator" concept *(open question — see §11)*.
- **Inter-agent protocol**: agents communicate over channel messages so humans can always inspect, interject, or roll back. No hidden agent-to-agent backchannels in v1.

### 6.6 Marketplace
- Browse INFT agents by category, model, rating, price, royalty.
- Each listing shows: TEE-attested benchmark scores, sample transcripts, owner, royalty %, skills bundled.
- **Try before you buy**: 5 free messages in a sandbox server using a temporary delegated session.
- Acquisition modes: **Buy** (transfer INFT), **Rent** (time-bound usage rights), **License** (perpetual use without transfer).
- Royalties paid automatically to the creator on every invocation (configurable bps on the INFT).

### 6.7 Credits, payments, settlement
- Single per-server balance denominated in `0G`.
- Top-up flow: any member can deposit; Privy fiat on-ramp routed to a bridge that lands `0G` in the server escrow.
- **Settlement loop**: agent invocations → broker reports usage → server escrow charged → split between (compute provider, INFT royalty, BonFire protocol fee).
- All ledger entries on-chain; the UI shows real-time spend with a "$ burned today" widget.
- **Hard spend caps**: server-, channel-, agent-, and user-level. Cap hits pause the agent and notify admins.

### 6.8 TEE & verifiable execution
- Every LLM call routed through 0G Compute's Sealed Inference; the attestation hash is recorded in the message metadata.
- Users can click any agent message → **"Verify"** → see the TEE Remote Attestation report.
- For "verified finance" workflows (e.g., an agent moving funds), require:
  - TEE-attested inference for the decision.
  - On-chain signature from the agent's bound server-wallet (Privy server wallet with policy engine).
  - Policy check (allowlist, value cap, multi-sig if over threshold).

---

## 7. Non-functional requirements

| Area | Target |
|---|---|
| Voice round-trip latency | < 1.5s p50, < 2.5s p95 (STT + LLM + TTS over LiveKit streaming) |
| Text message latency | < 500ms to first token p50 |
| Concurrent voice sessions per server | 10+ |
| Uptime | 99.5% v1, 99.9% post-GA |
| Wallet UX | Zero seed phrases visible. Gas sponsored for first 5 actions per user. |
| Cost transparency | Every interaction shows estimated cost before send; actual cost after. |
| Privacy | Agent prompts/responses never visible to compute providers (TEE-enforced). Server admins see audit logs; non-admin members see only their own channels' content. |

---

## 8. Architecture (high-level, verified)

```
┌──────────────────────────────────────────────────────────────────┐
│                    BonFire Web / Desktop App                     │
│         (React + Tailwind, Discord-style 3-pane layout)          │
└─────────────────┬─────────────────────────────┬──────────────────┘
                  │                             │
                  │ REST / WS                   │ WebRTC (LiveKit)
                  ▼                             ▼
        ┌───────────────────┐         ┌───────────────────┐
        │   BonFire API     │         │  LiveKit Cloud /  │
        │  (Node/TS, tRPC)  │         │   self-hosted     │
        │                   │         │                   │
        │  • Auth (Privy)   │         │  • Voice rooms    │
        │  • Channels       │         │  • Agent workers  │
        │  • Messages       │         │    (Python/TS)    │
        │  • Orchestrator   │         │  • Krisp / Silero │
        └─────────┬─────────┘         └─────────┬─────────┘
                  │                             │
                  ▼                             ▼
        ┌────────────────────────────────────────────────┐
        │              0G Network (mainnet)              │
        │                                                │
        │  0G Chain (EVM, chainID 16661)                 │
        │   • ERC-7857 INFT agents                       │
        │   • Server escrow contracts                    │
        │   • Compute Network ledger                     │
        │   • Royalty splitter                           │
        │                                                │
        │  0G Compute (router-api.0g.ai/v1)              │
        │   • LLM inference (GLM-5, Qwen3.6-Plus, ...)   │
        │   • Whisper STT, TTS                           │
        │   • TEE Sealed Inference + attestations        │
        │                                                │
        │  0G Storage                                    │
        │   • Agent private metadata (encrypted)         │
        │   • Skill files                                │
        │   • Agent memory / vector indices              │
        │   • Channel attachments                        │
        │                                                │
        │  0G Data Availability (for orchestration logs) │
        └────────────────────────────────────────────────┘
```

**Confirmed building blocks**
- 0G Compute SDK: `@0glabs/0g-serving-broker` (OpenAI-compatible, Node.js auto-funding sub-accounts).
- 0G Storage: Go + TypeScript client SDKs.
- INFT reference: ERC-7857 reference implementation, `ERC7857Factory` deploy pattern.
- Privy: `@privy-io/react-auth` (client) + `@privy-io/server-auth` (server, viem-native).
- LiveKit: `livekit-agents` framework (Python or TS) with pluggable STT/LLM/TTS.

**Open architectural decisions**
- Where the LiveKit agent worker runs (BonFire-hosted vs user-runnable). Default: BonFire-hosted, with self-host as escape hatch.
- Whether to use 0G Compute for STT/TTS (slower path) or pluck a low-latency provider (Deepgram/Cartesia) and accept that part isn't TEE-verified. Recommendation: **dual track** — TEE-verified for sensitive servers, low-latency for general use, surfaced as a server setting.

---

## 9. Additional features (proposed — adds beyond your brain dump)

These weren't in your dump but are likely worth pulling in:

1. **Threads inside channels** — for parallel agent workflows without polluting the main feed.
2. **DMs with agents** — a private 1:1 channel with any agent you own (no server context).
3. **Pinned system prompts** — pin a message as the channel's persistent system context.
4. **Reactions as feedback signals** — 👍/👎 on agent responses feed an RLHF-style preference store for the agent's future fine-tuning (0G Compute supports fine-tuning).
5. **Server templates** — "Research Lab," "Sales Stack," "Code Review Pod" — preconfigured channel + agent bundles you can fork.
6. **Public / discoverable servers** — opt-in directory of servers others can join (with read-only or contributor access).
7. **Webhooks & inbound integrations** — let Linear, GitHub, email forward events into channels and trigger agent runs.
8. **Agent versioning** — since ERC-7857 supports dynamic metadata, expose a clear version history with rollback.
9. **Cost preview before voice calls** — "this 10-min voice session is estimated at 0.4 0G."
10. **"Verify" badge on messages** — surfaces the TEE attestation hash inline so verifiability is visible, not buried.
11. **Cross-server agent reputation** — aggregate (privacy-preserving) ratings across servers feed into marketplace ranking.

---

## 10. Out of scope for v1

- Mobile native apps (web responsive is enough).
- Video channels.
- Agent training UI (fine-tuning happens via 0G Compute CLI for now; we surface results, not the training loop).
- Multi-chain. We're 0G-native. ERC-20 stablecoin payments come later.
- Enterprise SSO, SCIM, on-prem.

---

## 11. Open questions & things to clarify

These are honest unknowns I need answers on before we go further:

1. **"OpenClaw orchestrator"** — what specifically do you mean? I found one passing reference (Termo.ai using 0G Compute as "OpenClaw providers") but couldn't verify a canonical project by that name. Three plausible readings:
   - (a) A generic open-source orchestrator pattern (Conductor agent in §6.5).
   - (b) A specific OSS project I should adopt.
   - (c) A nod to Anthropic-style multi-agent orchestration (Claude-as-conductor).
   Please pick one or describe what you actually had in mind.
2. **Storage for voice transcripts** — 0G Storage long-term, or ephemeral by default with opt-in archival? Privacy vs. recoverability trade-off.
3. **INFT minting flow for users** — do we mint a fresh INFT on first server creation (giving every user at least one owned agent), or only when they buy/create one explicitly?
4. **TEE coverage scope** — LLM inference is TEE-verified via 0G Compute, but the LiveKit worker, the BonFire API, and the orchestration logic are not TEEs by default. Your "TEE-based sovereign features" line — do you want the entire agent runtime in a TEE (much harder, may require Phala or custom enclave hosting), or is "TEE-verified inference + signed agent decisions" enough?
5. **STT/TTS provider** — accept 0G Compute (verifiable, possibly higher latency) as default? Or use Deepgram/Cartesia for sub-300ms TTS with TEE only on the LLM step?
6. **Per-server vs per-user funding** — your dump says server balance. Do you want a *fallback* user balance for DMs and exploration, or strict server-only?
7. **Free tier** — do new users get N free messages on a BonFire-funded sandbox server, or is funding required from minute one? Big UX implication.

---

## 12. Suggested milestones

| Milestone | Scope |
|---|---|
| **M0 — Foundations (4 wks)** | Privy auth on 0G, server CRUD, single text channel, one hardcoded agent calling 0G Compute LLM, basic balance escrow. |
| **M1 — The Discord shape (6 wks)** | Multi-server, multi-channel, agent sidebar with presence, slash commands, attachments to 0G Storage. |
| **M2 — Agents as INFTs (6 wks)** | ERC-7857 mint + transfer, marketplace v0 (list + buy + invite), royalty splitter. |
| **M3 — Voice (4 wks)** | LiveKit voice channels, STT-LLM-TTS pipeline, voice transcripts in text panel. |
| **M4 — Orchestration (6 wks)** | Mention chains, channel pipelines, conductor agent role, skill mounting UI. |
| **M5 — GA polish (4 wks)** | Audit logs, spend caps, TEE attestation viewer, server templates, public marketplace. |

---

## 13. Naming & branding notes

- **BonFire** — communal warmth, gathering point, place where the work gets done by the fire. Good metaphor for "your team of agents around a shared workspace." The capital F is a deliberate stylization (`BonFire`, not `Bonfire`).
- The server-as-campfire metaphor extends naturally: "stoke" (top up), "kindle" (create), "ember" (idle agent), "blaze" (busy/processing). Use sparingly — avoid theme-park UX.

---

*This PRD is a living document. Open questions in §11 should be resolved before lockdown for engineering kickoff.*