import { AuditAction, Prisma } from '@prisma/client';
import { SettingRepository } from '../repositories/setting.repository';
import { AuditService, AuditContext } from './audit.service';

export class SettingService {
  constructor(
    private readonly settingRepo: SettingRepository,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.settingRepo.list();
  }

  get(key: string) {
    return this.settingRepo.get(key);
  }

  async set(key: string, value: Prisma.InputJsonValue, description: string | undefined, ctx: AuditContext) {
    const setting = await this.settingRepo.upsert(key, value, description, ctx.userId ?? undefined);
    await this.audit.record({
      ...ctx,
      action: AuditAction.SETTINGS_UPDATE,
      entityType: 'setting',
      entityId: key,
      metadata: { key },
    });
    return setting;
  }
}
