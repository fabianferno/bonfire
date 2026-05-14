import type { Context, Next, MiddlewareHandler } from 'hono';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { verifyToken } from './jwt.js';
import { findUserById } from '../users/service.js';
import type { UserDoc } from '../db/types.js';

export interface AuthBindings { Variables: { user: UserDoc } }

export function requireUser(db: Db, secret: string): MiddlewareHandler<AuthBindings> {
  return async (c: Context, next: Next) => {
    const auth = c.req.header('authorization');
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      return c.json({ error: 'missing bearer token' }, 401);
    }
    const token = auth.slice(7).trim();
    let claims;
    try { claims = await verifyToken(token, secret); }
    catch { return c.json({ error: 'invalid token' }, 401); }

    let userId: ObjectId;
    try { userId = new ObjectId(claims.sub); }
    catch { return c.json({ error: 'invalid token subject' }, 401); }

    const user = await findUserById(db, userId);
    if (!user) return c.json({ error: 'user not found' }, 401);

    c.set('user', user);
    await next();
  };
}
