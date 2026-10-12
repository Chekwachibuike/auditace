import { IncomeRepository } from './income.repository';
import { CreateIncomeDto, UpdateIncomeDto, IncomeFilterDto } from './income.dto';
import { NotFoundError } from '../../shared/AppError';

export class IncomeService {
  constructor(private incomeRepository: IncomeRepository) {}

  async createIncome(userId: string, data: CreateIncomeDto) {
    return this.incomeRepository.create(userId, data);
  }

  async getIncome(id: string, userId: string) {
    const income = await this.incomeRepository.findById(id, userId);
    if (!income) throw new NotFoundError('Income not found');
    return income;
  }

  async getIncomes(userId: string, filters: IncomeFilterDto) {
    return this.incomeRepository.findAll(userId, filters);
  }

  async updateIncome(id: string, userId: string, data: UpdateIncomeDto) {
    const existing = await this.incomeRepository.findById(id, userId);
    if (!existing) throw new NotFoundError('Income not found');
    return this.incomeRepository.update(id, userId, data);
  }

  async deleteIncome(id: string, userId: string) {
    const existing = await this.incomeRepository.findById(id, userId);
    if (!existing) throw new NotFoundError('Income not found');
    return this.incomeRepository.delete(id, userId);
  }

  async getCategories(userId: string) {
    return this.incomeRepository.getCategories(userId);
  }
}
