import { serve } from '@hono/node-server';
import { loadEnv } from './config/env.js';
import { connectDb } from './db/client.js';
import { createIndexes } from './db/indexes.js';
import { buildApp } from './api/server.js';
import { log } from './util/logger.js';
import { createInftChain } from './chain/inft.js';
import { createChainIndexer } from './chain/indexer.js';
import { createOgStorage } from './storage-0g/index.js';
import type { InftDeps } from './agents/invoker.js';

async function main() {
  const env = loadEnv();
  const { db, close: closeDb } = await connectDb(env);
  await createIndexes(db);
  log.info({ db: env.MONGODB_DB }, 'mongo connected');

  // Wire INFT integration when all three env vars are present.
  let inftDeps: InftDeps | undefined;
  let stopIndexer: (() => Promise<void>) | undefined;
  if (env.INFT_CONTRACT_ADDRESS && env.PLATFORM_EXECUTOR_PRIVATE_KEY) {
    const inft = createInftChain({ rpcUrl: env.OG_RPC_URL, contractAddress: env.INFT_CONTRACT_ADDRESS });
    const storage = createOgStorage();
    inftDeps = { inft, storage, platformExecutorPrivkey: env.PLATFORM_EXECUTOR_PRIVATE_KEY };
    const indexer = createChainIndexer({ db, inft, contractAddress: env.INFT_CONTRACT_ADDRESS, rpcUrl: env.OG_RPC_URL });
    await indexer.start();
    stopIndexer = () => indexer.stop();
    log.info({ contract: env.INFT_CONTRACT_ADDRESS }, 'INFT integration enabled');
  } else {
    log.warn('INFT integration disabled — set INFT_CONTRACT_ADDRESS + PLATFORM_EXECUTOR_PRIVATE_KEY to enable');
  }

  const app = buildApp({ db, jwtSecret: env.JWT_SECRET, jwtExpiresIn: env.JWT_EXPIRES_IN, inftDeps });
  const server = serve({ fetch: app.fetch, port: env.PORT });
  log.info({ port: env.PORT }, 'ready');

  const shutdown = async () => {
    log.info('shutting down');
    server.close();
    if (stopIndexer) await stopIndexer();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { log.error({ err: e }, 'fatal'); process.exit(1); });
