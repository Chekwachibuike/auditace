import { DashboardRepository } from './dashboard.repository';
import { MonthlySummary, CategoryBreakdown, BudgetComparison, DashboardOverview } from './dashboard.dto';

export class DashboardService {
  constructor(private dashboardRepository: DashboardRepository) {}

  async getMonthlySummaries(userId: string, months?: number): Promise<MonthlySummary[]> {
    if (months && (months < 1 || months > 24)) {
      throw new Error('Months parameter must be between 1 and 24');
    }

    return this.dashboardRepository.getMonthlySummaries(userId, months);
  }

  async getCategoryBreakdown(userId: string, month?: string): Promise<CategoryBreakdown[]> {
    if (month) {
      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        throw new Error('Month must be in YYYY-MM format');
      }

      // Validate that it's a valid date
      const [year, monthNum] = month.split('-').map(Number);
      if (year < 2020 || year > 2030 || monthNum < 1 || monthNum > 12) {
        throw new Error('Invalid month provided');
      }
    }

    return this.dashboardRepository.getCategoryBreakdown(userId, month);
  }

  async getBudgetComparisons(userId: string): Promise<BudgetComparison[]> {
    return this.dashboardRepository.getBudgetComparisons(userId);
  }

  async getDashboardOverview(userId: string): Promise<DashboardOverview> {
    return this.dashboardRepository.getDashboardOverview(userId);
  }
}
