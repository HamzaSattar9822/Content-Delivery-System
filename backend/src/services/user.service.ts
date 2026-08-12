import { randomUUID } from 'crypto';
import { AuditAction, Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { RoleRepository } from '../repositories/role.repository';
import { UserRepository } from '../repositories/user.repository';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { parsePagination, buildPaginated } from '../utils/http';
import { importEsm } from '../lib/esm';
import { AuditService, AuditContext } from './audit.service';

type CryptoModule = { hashPassword: (password: string) => Promise<string> };

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: Record<string, unknown>) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const [data, total] = await this.userRepo.list({
      skip,
      take,
      search: query.search ? String(query.search) : undefined,
      status: query.status as UserStatus | undefined,
      roleId: query.roleId ? String(query.roleId) : undefined,
    });
    return buildPaginated(data, total, { page, pageSize });
  }

  async getById(id: string) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async create(input: { email: string; name?: string; roleName: string }, ctx: AuditContext) {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('A user with this email already exists');
    const role = await this.roleRepo.findByName(input.roleName);
    if (!role) throw new BadRequestError('Invalid role');

    const user = await this.userRepo.create({
      email: input.email,
      name: input.name,
      role: { connect: { id: role.id } },
    });
    await this.audit.record({
      ...ctx,
      action: AuditAction.USER_CREATE,
      entityType: 'user',
      entityId: user.id,
      metadata: { email: input.email, role: input.roleName },
    });
    return user;
  }

  async update(
    id: string,
    input: { name?: string; roleName?: string; status?: UserStatus },
    ctx: AuditContext,
  ) {
    await this.getById(id);
    const data: Record<string, unknown> = { name: input.name, status: input.status };
    if (input.roleName) {
      const role = await this.roleRepo.findByName(input.roleName);
      if (!role) throw new BadRequestError('Invalid role');
      data.role = { connect: { id: role.id } };
    }
    const user = await this.userRepo.update(id, data);
    await this.audit.record({
      ...ctx,
      action: AuditAction.USER_UPDATE,
      entityType: 'user',
      entityId: id,
      metadata: {
        email: user.email,
        name: user.name,
        role: input.roleName,
        status: input.status,
        changes: Object.keys(input),
      },
    });
    return user;
  }

  async remove(id: string, ctx: AuditContext) {
    if (ctx.userId === id) throw new ForbiddenError('You cannot delete your own account');
    const existing = await this.getById(id);

    try {
      // Clear Better Auth rows first so a partial FK failure never leaves a
      // half-deleted identity that can resurface after refresh.
      await prisma.$transaction([
        prisma.authSession.deleteMany({ where: { userId: id } }),
        prisma.account.deleteMany({ where: { userId: id } }),
        prisma.refreshToken.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
      ]);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003') {
          throw new ConflictError(
            'This user cannot be deleted because related records still reference them. Suspend the account instead.',
          );
        }
        if (err.code === 'P2025') {
          throw new NotFoundError('User not found');
        }
      }
      throw err;
    }

    await this.audit.record({
      ...ctx,
      action: AuditAction.USER_DELETE,
      entityType: 'user',
      entityId: id,
      metadata: { email: existing.email, name: existing.name },
    });
  }

  async setPassword(id: string, input: { password: string }, ctx: AuditContext) {
    const user = await this.getById(id);
    const { hashPassword } = await importEsm<CryptoModule>('better-auth/crypto');
    const hashedPassword = await hashPassword(input.password);

    const credential = await prisma.account.findFirst({
      where: { userId: user.id, providerId: 'credential' },
    });

    if (!credential) {
      await prisma.account.create({
        data: {
          id: randomUUID(),
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password: hashedPassword,
        },
      });
    } else {
      await prisma.account.update({
        where: { id: credential.id },
        data: { password: hashedPassword },
      });
    }

    await this.audit.record({
      ...ctx,
      action: AuditAction.USER_UPDATE,
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        changes: ['password'],
      },
    });

    return { updated: true };
  }

  listRoles() {
    return this.roleRepo.list();
  }
}
