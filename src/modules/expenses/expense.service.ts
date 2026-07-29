import { ExpenseRepository } from './expense.repository';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './expense.dto';
import { NotFoundError } from '../../shared/AppError';

export class ExpenseService {
  constructor(private expenseRepository: ExpenseRepository) {}

  async createExpense(userId: string, data: CreateExpenseDto) {
    return this.expenseRepository.create(userId, data);
  }

  async getExpense(id: string, userId: string) {
    const expense = await this.expenseRepository.findById(id, userId);
    if (!expense) {
      throw new NotFoundError('Expense not found');
    }
    return expense;
  }

  async getExpenses(userId: string, filters: ExpenseFilterDto) {
    return this.expenseRepository.findAll(userId, filters);
  }

  async updateExpense(id: string, userId: string, data: UpdateExpenseDto) {
    const existingExpense = await this.expenseRepository.findById(id, userId);
    if (!existingExpense) {
      throw new NotFoundError('Expense not found');
    }

    return this.expenseRepository.update(id, userId, data);
  }

  async deleteExpense(id: string, userId: string) {
    const existingExpense = await this.expenseRepository.findById(id, userId);
    if (!existingExpense) {
      throw new NotFoundError('Expense not found');
    }

    return this.expenseRepository.delete(id, userId);
  }

  async getCategories(userId: string) {
    return this.expenseRepository.getCategories(userId);
  }
}
