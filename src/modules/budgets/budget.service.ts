import { BudgetRepository } from './budget.repository';
import { CreateBudgetDto, UpdateBudgetDto, BudgetFilterDto } from './budget.dto';
import { NotFoundError, ConflictError, ForbiddenError } from '../../shared/AppError';

export class BudgetService {
  constructor(private budgetRepository: BudgetRepository) {}

  async createBudget(userId: string, data: CreateBudgetDto) {
    // amount/name/period/date-order are enforced by createBudgetSchema at
    // the route boundary; only genuine business-rule checks remain here.
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Check for duplicate budget in same period
    const existingBudget = await this.budgetRepository.findByCategoryAndPeriod(
      userId,
      data.category || null,
      data.period,
      startDate,
      endDate
    );

    if (existingBudget) {
      throw new ConflictError(`Budget already exists for this ${data.period} period and category`);
    }

    return this.budgetRepository.create(userId, data);
  }

  async getBudget(id: string, userId: string) {
    const budget = await this.budgetRepository.findById(id, userId);
    if (!budget) {
      throw new NotFoundError('Budget not found');
    }
    return budget;
  }

  async getBudgets(userId: string, filters: BudgetFilterDto) {
    return this.budgetRepository.findAll(userId, filters);
  }

  async updateBudget(id: string, userId: string, data: UpdateBudgetDto) {
    const existingBudget = await this.budgetRepository.findById(id, userId);
    if (!existingBudget) {
      throw new NotFoundError('Budget not found');
    }

    // Check if budget period has already started - if so, prevent editing
    const now = new Date();
    if (existingBudget.startDate <= now) {
      throw new ForbiddenError('Cannot edit budget once the period has started');
    }

    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate) : existingBudget.startDate;
      const endDate = data.endDate ? new Date(data.endDate) : existingBudget.endDate;

      if (startDate >= endDate) {
        throw new ConflictError('Start date must be before end date');
      }

      // Check for conflicts with other budgets
      const conflictBudget = await this.budgetRepository.findByCategoryAndPeriod(
        userId,
        data.category !== undefined ? data.category : existingBudget.category,
        data.period !== undefined ? data.period : existingBudget.period,
        startDate,
        endDate
      );

      if (conflictBudget && conflictBudget.id !== id) {
        throw new ConflictError(`Another budget exists for this period and category`);
      }
    }

    return this.budgetRepository.update(id, userId, data);
  }

  async deleteBudget(id: string, userId: string) {
    const existingBudget = await this.budgetRepository.findById(id, userId);
    if (!existingBudget) {
      throw new NotFoundError('Budget not found');
    }

    // Allow deletion even if period has started (user discretion)
    return this.budgetRepository.delete(id, userId);
  }

  async getBudgetWithExpenses(userId: string, budgetId: string) {
    const budget = await this.getBudget(budgetId, userId);
    const expenses = await this.budgetRepository.getBudgetExpenses(userId, budgetId);

    const totalSpent = expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);
    const remaining = budget.amount - totalSpent;
    const percentageUsed = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;

    return {
      ...budget,
      totalSpent,
      remaining,
      percentageUsed,
      expenses,
    };
  }
}
