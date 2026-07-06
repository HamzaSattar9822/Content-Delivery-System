import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ensureCoreSeed } from '../src/bootstrap/ensureCoreSeed';
import { ROLES } from '../src/config/permissions';

describe('ensureCoreSeed', () => {
  const prisma = {
    permission: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([{ id: 'perm-1', key: 'user:view' }]),
    },
    role: { upsert: vi.fn().mockResolvedValue({ id: 'role-1' }) },
    rolePermission: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.role.upsert).mockResolvedValue({ id: 'role-1' } as never);
  });

  it('upserts all roles', async () => {
    await ensureCoreSeed(prisma);
    expect(prisma.role.upsert).toHaveBeenCalled();
    const names = vi.mocked(prisma.role.upsert).mock.calls.map((c) => c[0].where.name);
    expect(names).toContain(ROLES.SUPER_ADMIN);
    expect(names).toContain(ROLES.READ_ONLY);
  });
});
