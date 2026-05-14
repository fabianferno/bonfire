import { z } from 'zod';

export const TenantSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(500),
  avatarUrl: z.string().url().nullable().default(null),
  tags: z.array(z.string()).default([]),
  soul: z.string().default(''),
  agents: z.string().default(''),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type Tenant = z.infer<typeof TenantSchema>;
