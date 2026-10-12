import { prisma } from '../../database/prisma';
import { CreateIncomeDto, UpdateIncomeDto, IncomeFilterDto } from './income.dto';

/**
 * Uses the SHARED Prisma client rather than constructing its own.
 *
 * The expenses repository instantiates `new PrismaClient()` at module scope,
 * which opens a second connection pool. On a free-tier Postgres with a small
 * connection limit that is a real cost, and it is the kind of thing that only
 * shows up under load. New modules use the shared instance.
 */
export class IncomeRepository {
  async create(userId: string, data: CreateIncomeDto) {
    return prisma.income.create({
      data: { ...data, date: new Date(data.date), userId },
    });
  }

  async findById(id: string, userId: string) {
    return prisma.income.findFirst({ where: { id, userId } });
  }

  async findAll(userId: string, filters: IncomeFilterDto = {}) {
    const where: Record<string, unknown> = { userId };

    if (filters.month) {
      const [year, month] = filters.month.split('-').map(Number);
      // The last day is derived, never assumed. Day 0 of the NEXT month is the
      // last day of this one, which is correct for 30-day months and February
      // alike. Hard-coding 31 produces an invalid date in those months, and an
      // invalid bound silently returns nothing rather than erroring.
      where.date = {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      };
    }

    if (filters.category) where.category = filters.category;

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { category: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.income.findMany({ where, orderBy: { date: 'desc' } });
  }

  async update(id: string, userId: string, data: UpdateIncomeDto) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.date) updateData.date = new Date(data.date);

    return prisma.income.update({ where: { id, userId }, data: updateData });
  }

  async delete(id: string, userId: string) {
    return prisma.income.delete({ where: { id, userId } });
  }

  async getCategories(userId: string) {
    const rows = await prisma.income.findMany({
      where: { userId },
      select: { category: true },
      distinct: ['category'],
    });
    return rows.map((r) => r.category);
  }
}
