import { PrismaClient } from '@prisma/client';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './expense.dto';

export class ExpenseRepository {
  private prisma = new PrismaClient();

  async create(userId: string, data: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        ...data,
        date: new Date(data.date),
        userId,
      },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.expense.findFirst({
      where: { id, userId },
    });
  }

  async findAll(userId: string, filters: ExpenseFilterDto = {}) {
    const where: any = { userId };

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      const startDate = new Date(`${year}-${month}-01`);
      const endDate = new Date(`${year}-${month}-31`);
      
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { category: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async update(id: string, userId: string, data: UpdateExpenseDto) {
    const updateData: any = { ...data };
    
    if (data.date) {
      updateData.date = new Date(data.date);
    }

    return this.prisma.expense.update({
      where: { id, userId },
      data: updateData,
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.expense.delete({
      where: { id, userId },
    });
  }

  async getCategories(userId: string) {
    const expenses = await this.prisma.expense.findMany({
      where: { userId },
      select: { category: true },
      distinct: ['category'],
    });
    
    return expenses.map((e: any) => e.category);
  }
}
