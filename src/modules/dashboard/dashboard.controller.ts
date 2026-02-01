import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  getMonthlySummaries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const months = req.query.months ? parseInt(req.query.months as string) : 12;
      const summaries = await this.dashboardService.getMonthlySummaries(req.user.id, months);
      
      res.status(200).json(summaries);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get monthly summaries';
      res.status(400).json({ message });
    }
  };

  getCategoryBreakdown = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const month = req.query.month as string;
      const breakdown = await this.dashboardService.getCategoryBreakdown(req.user.id, month);
      
      res.status(200).json(breakdown);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get category breakdown';
      res.status(400).json({ message });
    }
  };

  getBudgetComparisons = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const comparisons = await this.dashboardService.getBudgetComparisons(req.user.id);
      
      res.status(200).json(comparisons);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get budget comparisons';
      res.status(400).json({ message });
    }
  };

  getDashboardOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const overview = await this.dashboardService.getDashboardOverview(req.user.id);
      
      res.status(200).json(overview);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get dashboard overview';
      res.status(400).json({ message });
    }
  };
}
