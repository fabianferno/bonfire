# backend/scripts

One-off and maintenance scripts for the BonFire backend. All scripts are ESM and
should be run with `pnpm tsx <script>` from the `backend/` directory.

---

## mint-seed-agents.mjs

**Purpose:** One-shot migration that tokenizes the 8 seed agent personalities
from `agent/data/tenants.json` as `BonFireAgentINFT` on-chain assets, uploads
their encrypted bundles to 0G Storage, and writes the resulting `AgentDoc`
records into MongoDB.

### Required environment variables

| Variable | Description |
|---|---|
| `SEED_OWNER_PRIVATE_KEY` | Private key of the wallet that will own all seed INFTs. Must hold ~5 OG for gas. |
| `PLATFORM_EXECUTOR_PRIVATE_KEY` | Platform executor keypair. Its public key is used to ECIES-seal each DEK. |
| `INFT_CONTRACT_ADDRESS` | Deployed `BonFireAgentINFT` contract address (0x…). |
| `MONGO_URL` | MongoDB connection string for the BonFire backend database. |
| `OG_RPC_URL` | (Optional) 0G Chain JSON-RPC endpoint. Defaults to `https://evmrpc-testnet.0g.ai`. |
| `OG_STORAGE_MOCK` | (Optional) Set to `1` to use the filesystem mock instead of real 0G Storage. |
| `EMBER_AGENT_BASE_URL` | (Optional) `baseUrl` written into each `AgentDoc`. Defaults to `http://localhost:7777`. |

### Idempotency

The script checks MongoDB for an existing `AgentDoc` with a matching `slug` **and** a
`tokenId` field before minting. Any slug that is already minted is silently
skipped, making the script safe to re-run after a partial failure.

### Roll-back procedure

1. Drop all `AgentDoc` records that have a `tokenId` field and whose `slug`
   appears in `tenants.json.legacy`:
   ```js
   db.agents.deleteMany({ tokenId: { $exists: true }, slug: { $in: [...seedSlugs] } })
   ```
2. Rename `agent/data/tenants.json.legacy` back to `agent/data/tenants.json`.
3. On-chain mints cannot be undone (transfers are disabled in v1), but the
   orphaned tokens do not affect platform behaviour.

### Recommended dry-run sequence

```bash
# Step 1 — mock storage (no real 0G uploads, no on-chain tx needed for smoke test)
cd backend
OG_STORAGE_MOCK=1 \
  SEED_OWNER_PRIVATE_KEY=0x<key> \
  PLATFORM_EXECUTOR_PRIVATE_KEY=0x<key> \
  INFT_CONTRACT_ADDRESS=0x<addr> \
  MONGO_URL=mongodb://localhost:27017/bonfire \
  pnpm tsx scripts/mint-seed-agents.mjs

# Step 2 — real run (real 0G Storage + on-chain mint)
cd backend
SEED_OWNER_PRIVATE_KEY=0x<key> \
  PLATFORM_EXECUTOR_PRIVATE_KEY=0x<key> \
  INFT_CONTRACT_ADDRESS=0x<addr> \
  MONGO_URL=<production-mongo-url> \
  pnpm tsx scripts/mint-seed-agents.mjs
```

---

## dev-mongo.mjs

Starts a local MongoDB instance for development.
