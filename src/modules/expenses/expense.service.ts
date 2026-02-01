import { ExpenseRepository } from './expense.repository';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './expense.dto';

export class ExpenseService {
  constructor(private expenseRepository: ExpenseRepository) {}

  async createExpense(userId: string, data: CreateExpenseDto) {
    if (data.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (!data.category.trim()) {
      throw new Error('Category is required');
    }

    return this.expenseRepository.create(userId, data);
  }

  async getExpense(id: string, userId: string) {
    const expense = await this.expenseRepository.findById(id, userId);
    if (!expense) {
      throw new Error('Expense not found');
    }
    return expense;
  }

  async getExpenses(userId: string, filters: ExpenseFilterDto) {
    return this.expenseRepository.findAll(userId, filters);
  }

  async updateExpense(id: string, userId: string, data: UpdateExpenseDto) {
    const existingExpense = await this.expenseRepository.findById(id, userId);
    if (!existingExpense) {
      throw new Error('Expense not found');
    }

    if (data.amount !== undefined && data.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (data.category !== undefined && !data.category.trim()) {
      throw new Error('Category cannot be empty');
    }

    return this.expenseRepository.update(id, userId, data);
  }

  async deleteExpense(id: string, userId: string) {
    const existingExpense = await this.expenseRepository.findById(id, userId);
    if (!existingExpense) {
      throw new Error('Expense not found');
    }

    return this.expenseRepository.delete(id, userId);
  }

  async getCategories(userId: string) {
    return this.expenseRepository.getCategories(userId);
  }
}
