import { serve } from '@hono/node-server';
import { loadEnv } from './config/env.js';
import { connectDb } from './db/client.js';
import { createIndexes } from './db/indexes.js';
import { buildApp } from './api/server.js';
import { log } from './util/logger.js';

async function main() {
  const env = loadEnv();
  const { db, close: closeDb } = await connectDb(env);
  await createIndexes(db);
  log.info({ db: env.MONGODB_DB }, 'mongo connected');

  const app = buildApp({ db, jwtSecret: env.JWT_SECRET, jwtExpiresIn: env.JWT_EXPIRES_IN });
  const server = serve({ fetch: app.fetch, port: env.PORT });
  log.info({ port: env.PORT }, 'ready');

  const shutdown = async () => {
    log.info('shutting down');
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { log.error({ err: e }, 'fatal'); process.exit(1); });
