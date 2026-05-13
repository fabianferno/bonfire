import type { Db } from 'mongodb';
import { buildApp } from '../../src/api/server.js';
import { jsonReq } from './app.js';

export interface RegisteredUser {
  token: string;
  user: { id: string; username: string; email: string; displayName: string };
}

export async function registerAndLogin(
  app: ReturnType<typeof buildApp>,
  override: Partial<{ email: string; username: string; password: string; displayName: string }> = {}
): Promise<RegisteredUser> {
  const seed = Math.random().toString(36).slice(2, 8);
  const body = {
    email: override.email ?? `u${seed}@test.local`,
    username: override.username ?? `u${seed}`,
    password: override.password ?? 'correct horse battery staple',
    displayName: override.displayName ?? `User ${seed}`,
  };
  const res = await jsonReq(app, 'POST', '/v1/auth/register', body);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return res.body;
}
