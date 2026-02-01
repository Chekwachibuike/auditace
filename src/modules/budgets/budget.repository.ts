import { PrismaClient } from '@prisma/client';
import { CreateBudgetDto, UpdateBudgetDto, BudgetFilterDto } from './budget.dto';

export class BudgetRepository {
  private prisma = new PrismaClient();

  async create(userId: string, data: CreateBudgetDto) {
    return this.prisma.budget.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        userId,
      },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.budget.findFirst({
      where: { id, userId },
    });
  }

  async findAll(userId: string, filters: BudgetFilterDto = {}) {
    const where: any = { userId };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.period) {
      where.period = filters.period;
    }

    if (filters.active !== undefined) {
      const now = new Date();
      if (filters.active) {
        where.startDate = { lte: now };
        where.endDate = { gte: now };
      } else {
        where.OR = [
          { startDate: { gt: now } },
          { endDate: { lt: now } },
        ];
      }
    }

    return this.prisma.budget.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
  }

  async update(id: string, userId: string, data: UpdateBudgetDto) {
    const updateData: any = { ...data };
    
    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate);
    }

    return this.prisma.budget.update({
      where: { id, userId },
      data: updateData,
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.budget.delete({
      where: { id, userId },
    });
  }

  async findByCategoryAndPeriod(userId: string, category: string | null, period: string, startDate: Date, endDate: Date) {
    return this.prisma.budget.findFirst({
      where: {
        userId,
        category,
        period,
        startDate: { lte: startDate },
        endDate: { gte: endDate },
      },
    });
  }

  async getBudgetExpenses(userId: string, budgetId: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id: budgetId, userId },
    });

    if (!budget) return [];

    return this.prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: budget.startDate,
          lte: budget.endDate,
        },
        ...(budget.category && { category: budget.category }),
      },
    });
  }
}
