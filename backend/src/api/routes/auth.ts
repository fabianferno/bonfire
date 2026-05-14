import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { signToken } from '../../auth/jwt.js';
import { requireUser, type AuthBindings } from '../../auth/middleware.js';
import { createUser, findUserByEmailOrUsername, privateUser } from '../../users/service.js';

const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

const RegisterBody = z.object({
  email: z.string().email(),
  username: z.string().transform(s => s.toLowerCase()).pipe(z.string().regex(USERNAME_RE, 'username must match /^[a-z0-9_-]{3,32}$/')),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(64),
  avatarUrl: z.string().url().nullish(),
  bio: z.string().max(280).nullish(),
});

const LoginBody = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

export interface AuthRouteDeps { db: Db; jwtSecret: string; jwtExpiresIn: string; }

export function authRoutes(deps: AuthRouteDeps) {
  const app = new Hono<AuthBindings>();

  app.post('/v1/auth/register', async (c) => {
    const parsed = RegisterBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
    const b = parsed.data;

    const lcUsername = b.username.toLowerCase();
    const existing = await findUserByEmailOrUsername(deps.db, b.email)
      ?? await findUserByEmailOrUsername(deps.db, lcUsername);
    if (existing) return c.json({ error: 'email_or_username_taken' }, 409);

    const passwordHash = await hashPassword(b.password);
    const user = await createUser(deps.db, {
      email: b.email,
      username: lcUsername,
      passwordHash,
      displayName: b.displayName,
      avatarUrl: b.avatarUrl ?? null,
      bio: b.bio ?? null,
    });
    const token = await signToken({ sub: user._id.toHexString(), username: user.username }, deps.jwtSecret, deps.jwtExpiresIn);
    return c.json({ token, user: privateUser(user) }, 201);
  });

  app.post('/v1/auth/login', async (c) => {
    const parsed = LoginBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const { emailOrUsername, password } = parsed.data;

    const user = await findUserByEmailOrUsername(deps.db, emailOrUsername);
    if (!user) return c.json({ error: 'invalid_credentials' }, 401);
    if (!(await verifyPassword(user.passwordHash, password))) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }
    const token = await signToken({ sub: user._id.toHexString(), username: user.username }, deps.jwtSecret, deps.jwtExpiresIn);
    return c.json({ token, user: privateUser(user) });
  });

  app.get('/v1/auth/me', requireUser(deps.db, deps.jwtSecret), (c) => {
    return c.json({ user: privateUser(c.get('user')) });
  });

  return app;
}
