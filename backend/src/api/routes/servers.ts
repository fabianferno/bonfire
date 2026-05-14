import { Hono } from 'hono';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { requireUser } from '../../auth/middleware.js';
import { requireServerMember, type ServerBindings } from '../../servers/middleware.js';
import type { ChannelDoc } from '../../db/types.js';
import { collections } from '../../db/types.js';
import {
  SlugTakenError, createServer, listServersForUser, publicServer,
  listServerMembers, publicMember, addMember, ownerWallet,
} from '../../servers/service.js';
import { fetchOnchainBalance } from '../../servers/wallet.js';

const SLUG_RE = /^[a-z0-9_-]{1,32}$/;

const CreateServerBody = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().regex(SLUG_RE),
  iconUrl: z.string().url().nullish(),
});

const PatchServerBody = z.object({
  name: z.string().min(1).max(64).optional(),
  iconUrl: z.string().url().nullable().optional(),
});

export interface ServerRouteDeps { db: Db; jwtSecret: string; }

export function serverRoutes(deps: ServerRouteDeps) {
  const app = new Hono<ServerBindings>();
  const requireAuth = requireUser(deps.db, deps.jwtSecret);

  app.post('/v1/servers', requireAuth, async (c) => {
    const parsed = CreateServerBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
    try {
      const { server } = await createServer(deps.db, {
        name: parsed.data.name,
        slug: parsed.data.slug,
        iconUrl: parsed.data.iconUrl ?? null,
        ownerId: c.get('user')._id,
      });
      return c.json({
        server: publicServer(server),
        wallet: ownerWallet(server.wallet!),
        funding: {
          faucetUrl: 'https://faucet.0g.ai',
          rpcUrl: 'https://evmrpc-testnet.0g.ai',
          chainId: 16601,
          minRecommendedBalance: '4',
          tokenSymbol: 'OG',
          note: 'Fund this address with at least 4 OG. The 0G ledger requires a 3 OG minimum + gas reserve.',
        },
      }, 201);
    } catch (e) {
      if (e instanceof SlugTakenError) return c.json({ error: 'slug_taken' }, 409);
      throw e;
    }
  });

  app.get('/v1/servers', requireAuth, async (c) => {
    const servers = await listServersForUser(deps.db, c.get('user')._id);
    return c.json({ servers: servers.map(publicServer) });
  });

  app.get('/v1/servers/:sid', requireAuth, requireServerMember(deps.db), (c) => {
    return c.json({ server: publicServer(c.get('server')) });
  });

  app.patch('/v1/servers/:sid', requireAuth, requireServerMember(deps.db, 'admin'), async (c) => {
    const parsed = PatchServerBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) $set.name = parsed.data.name;
    if (parsed.data.iconUrl !== undefined) $set.iconUrl = parsed.data.iconUrl;
    const res = await deps.db.collection(collections.servers).findOneAndUpdate(
      { _id: c.get('server')._id }, { $set }, { returnDocument: 'after' }
    );
    if (!res) return c.json({ error: 'not_found' }, 404);
    return c.json({ server: publicServer(res as any) });
  });

  app.delete('/v1/servers/:sid', requireAuth, requireServerMember(deps.db, 'owner'), async (c) => {
    const serverId = c.get('server')._id;
    await deps.db.collection(collections.messages).deleteMany({ serverId });
    await deps.db.collection(collections.channels).deleteMany({ serverId });
    await deps.db.collection(collections.serverMembers).deleteMany({ serverId });
    await deps.db.collection(collections.servers).deleteOne({ _id: serverId });
    return c.json({ ok: true });
  });

  app.get('/v1/servers/:sid/members', requireAuth, requireServerMember(deps.db), async (c) => {
    const typeParam = c.req.query('type');
    const type = typeParam === 'user' || typeParam === 'agent' ? typeParam : undefined;
    const members = await listServerMembers(deps.db, c.get('server')._id, type);
    return c.json({ members: members.map(publicMember) });
  });

  app.get('/v1/servers/:sid/channels', requireAuth, requireServerMember(deps.db), async (c) => {
    const channels = await deps.db.collection<ChannelDoc>(collections.channels)
      .find({ serverId: c.get('server')._id })
      .sort({ position: 1 })
      .toArray();
    return c.json({
      channels: channels.map(ch => ({
        id: ch._id.toHexString(),
        serverId: ch.serverId.toHexString(),
        name: ch.name,
        topic: ch.topic,
        type: ch.type,
        defaultAgentId: ch.defaultAgentId?.toHexString() ?? null,
        position: ch.position,
        createdAt: ch.createdAt.toISOString(),
      })),
    });
  });

  const AddMemberBody = z.object({
    principalType: z.enum(['user', 'agent']),
    principalId: z.string().regex(/^[a-f0-9]{24}$/i),
    role: z.enum(['admin', 'member']).optional(),
    alias: z.string().max(64).nullish(),
  });

  app.post('/v1/servers/:sid/members', requireAuth, requireServerMember(deps.db, 'admin'), async (c) => {
    const parsed = AddMemberBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
    const principalId = new ObjectId(parsed.data.principalId);

    const targetCollection = parsed.data.principalType === 'user' ? collections.users : collections.agents;
    const exists = await deps.db.collection(targetCollection).findOne({ _id: principalId });
    if (!exists) return c.json({ error: 'principal_not_found' }, 404);

    const dup = await deps.db.collection(collections.serverMembers).findOne({
      serverId: c.get('server')._id,
      principalType: parsed.data.principalType,
      principalId,
    });
    if (dup) return c.json({ error: 'already_a_member' }, 409);

    const added = await addMember(deps.db, {
      serverId: c.get('server')._id,
      principalType: parsed.data.principalType,
      principalId,
      role: parsed.data.role ?? 'member',
      alias: parsed.data.alias ?? null,
    });
    return c.json({ member: publicMember(added) }, 201);
  });

  app.get('/v1/servers/:sid/wallet', requireAuth, requireServerMember(deps.db, 'admin'), async (c) => {
    const server = c.get('server');
    if (!server.wallet) return c.json({ error: 'no_wallet' }, 404);

    let balance: string | null = null;
    let balanceError: string | null = null;
    try {
      const rpcUrl = process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai';
      balance = await fetchOnchainBalance(rpcUrl, server.wallet.address);
    } catch (e: any) {
      balanceError = e?.message ?? String(e);
    }

    return c.json({
      wallet: ownerWallet(server.wallet),
      balance,
      balanceError,
      funding: {
        faucetUrl: 'https://faucet.0g.ai',
        rpcUrl: process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai',
        tokenSymbol: 'OG',
      },
    });
  });

  app.delete('/v1/servers/:sid/members/:mid', requireAuth, requireServerMember(deps.db), async (c) => {
    const mid = c.req.param('mid');
    if (!ObjectId.isValid(mid)) return c.json({ error: 'invalid_member_id' }, 400);
    const memberId = new ObjectId(mid);

    const target = await deps.db.collection(collections.serverMembers).findOne({ _id: memberId, serverId: c.get('server')._id });
    if (!target) return c.json({ error: 'not_found' }, 404);

    const me = c.get('membership');
    const selfLeave = target.principalType === 'user' && target.principalId.equals(c.get('user')._id);
    const isAdmin = me.role === 'owner' || me.role === 'admin';
    if (!selfLeave && !isAdmin) return c.json({ error: 'forbidden' }, 403);
    if (target.role === 'owner') return c.json({ error: 'cannot_remove_owner' }, 400);

    await deps.db.collection(collections.serverMembers).deleteOne({ _id: memberId });
    return c.json({ ok: true });
  });

  return app;
}
