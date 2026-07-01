import { prisma } from '../db/prisma';

export class RoleRepository {
  constructor(private readonly db = prisma) {}

  findByName(name: string) {
    return this.db.role.findUnique({
      where: { name },
      include: { permissions: { include: { permission: true } } },
    });
  }

  findById(id: string) {
    return this.db.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
  }

  list() {
    return this.db.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
  }
}
