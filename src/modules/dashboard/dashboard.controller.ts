import { Response } from 'express';
import { DashboardService } from './dashboard.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../shared/AppError';

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  getMonthlySummaries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const months = req.query.months ? parseInt(req.query.months as string) : 12;
    const summaries = await this.dashboardService.getMonthlySummaries(req.user.id, months);

    res.status(200).json(summaries);
  };

  getCategoryBreakdown = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const month = req.query.month as string;
    const breakdown = await this.dashboardService.getCategoryBreakdown(req.user.id, month);

    res.status(200).json(breakdown);
  };

  getBudgetComparisons = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const comparisons = await this.dashboardService.getBudgetComparisons(req.user.id);

    res.status(200).json(comparisons);
  };

  getDashboardOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const overview = await this.dashboardService.getDashboardOverview(req.user.id);

    res.status(200).json(overview);
  };
}
