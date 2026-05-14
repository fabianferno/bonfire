import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  MAX_CASCADE_HOPS: z.coerce.number().int().nonnegative().default(5),
  MAX_INVOCATIONS_PER_ROOT: z.coerce.number().int().positive().default(20),
  OG_RPC_URL: z.string().url().default('https://evmrpc-testnet.0g.ai'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}
