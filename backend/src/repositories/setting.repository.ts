import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export class SettingRepository {
  constructor(private readonly db = prisma) {}

  list() {
    return this.db.setting.findMany({ orderBy: { key: 'asc' } });
  }

  get(key: string) {
    return this.db.setting.findUnique({ where: { key } });
  }

  upsert(key: string, value: Prisma.InputJsonValue, description: string | undefined, updatedById?: string) {
    return this.db.setting.upsert({
      where: { key },
      update: { value, description, updatedById },
      create: { key, value, description, updatedById },
    });
  }
}

export class RefreshTokenRepository {
  constructor(private readonly db = prisma) {}

  create(data: Prisma.RefreshTokenCreateInput) {
    return this.db.refreshToken.create({ data });
  }

  findValidByHash(tokenHash: string) {
    return this.db.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  revoke(tokenHash: string) {
    return this.db.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string) {
    return this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
