import { AuditAction, UserStatus } from '@prisma/client';
import { RoleRepository } from '../repositories/role.repository';
import { UserRepository } from '../repositories/user.repository';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { parsePagination, buildPaginated } from '../utils/http';
import { AuditService, AuditContext } from './audit.service';

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
    await this.audit.record({ ...ctx, action: AuditAction.USER_UPDATE, entityType: 'user', entityId: id });
    return user;
  }

  async remove(id: string, ctx: AuditContext) {
    if (ctx.userId === id) throw new ForbiddenError('You cannot delete your own account');
    await this.getById(id);
    await this.userRepo.delete(id);
    await this.audit.record({ ...ctx, action: AuditAction.USER_DELETE, entityType: 'user', entityId: id });
  }

  listRoles() {
    return this.roleRepo.list();
  }
}
