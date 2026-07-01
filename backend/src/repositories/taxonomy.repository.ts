import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class CategoryRepository {
  constructor(private readonly db = prisma) {}

  list() {
    return this.db.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { content: true } } },
    });
  }

  findById(id: string) {
    return this.db.category.findUnique({ where: { id } });
  }

  create(data: { name: string; description?: string }) {
    return this.db.category.create({
      data: { name: data.name, slug: slugify(data.name), description: data.description },
    });
  }

  update(id: string, data: { name?: string; description?: string }) {
    const payload: Prisma.CategoryUpdateInput = { description: data.description };
    if (data.name) {
      payload.name = data.name;
      payload.slug = slugify(data.name);
    }
    return this.db.category.update({ where: { id }, data: payload });
  }

  delete(id: string) {
    return this.db.category.delete({ where: { id } });
  }
}

export class TagRepository {
  constructor(private readonly db = prisma) {}

  list() {
    return this.db.tag.findMany({ orderBy: { name: 'asc' } });
  }

  /** Resolve tag names to ids, creating any that do not yet exist. */
  async upsertMany(names: string[]): Promise<string[]> {
    const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
    const ids: string[] = [];
    for (const name of unique) {
      const slug = slugify(name);
      const tag = await this.db.tag.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      });
      ids.push(tag.id);
    }
    return ids;
  }
}
