import { Prisma, User, UserStatus } from '@prisma/client';
import { prisma } from '../db/prisma';

export interface UserListFilter {
  search?: string;
  status?: UserStatus;
  roleId?: string;
  skip: number;
  take: number;
  orderBy?: Prisma.UserOrderByWithRelationInput;
}

export class UserRepository {
  constructor(private readonly db = prisma) {}

  findById(id: string) {
    return this.db.user.findUnique({ where: { id }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  }

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  }

  findByGoogleId(googleId: string) {
    return this.db.user.findUnique({ where: { googleId }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  }

  create(data: Prisma.UserCreateInput) {
    return this.db.user.create({ data, include: { role: true } });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({ where: { id }, data, include: { role: true } });
  }

  delete(id: string) {
    return this.db.user.delete({ where: { id } });
  }

  async list(filter: UserListFilter): Promise<[User[], number]> {
    const where: Prisma.UserWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.roleId) where.roleId = filter.roleId;
    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search, mode: 'insensitive' } },
        { name: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    return Promise.all([
      this.db.user.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: filter.orderBy ?? { createdAt: 'desc' },
        include: { role: true },
      }),
      this.db.user.count({ where }),
    ]);
  }

  count() {
    return this.db.user.count();
  }
}
