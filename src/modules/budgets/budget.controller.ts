import { Response } from 'express';
import { BudgetService } from './budget.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { CreateBudgetDto, UpdateBudgetDto, BudgetFilterDto } from './budget.dto';

export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  createBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const data: CreateBudgetDto = req.body;
      const budget = await this.budgetService.createBudget(req.user.id, data);
      
      res.status(201).json(budget);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create budget';
      res.status(400).json({ message });
    }
  };

  getBudgets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const filters: BudgetFilterDto = {
        category: req.query.category as string,
        period: req.query.period as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      };

      const budgets = await this.budgetService.getBudgets(req.user.id, filters);
      res.status(200).json(budgets);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get budgets';
      res.status(500).json({ message });
    }
  };

  getBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      const budget = await this.budgetService.getBudget(id, req.user.id);
      
      res.status(200).json(budget);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get budget';
      
      if (message === 'Budget not found') {
        res.status(404).json({ message });
        return;
      }
      
      res.status(500).json({ message });
    }
  };

  getBudgetWithExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      const budgetWithExpenses = await this.budgetService.getBudgetWithExpenses(req.user.id, id);
      
      res.status(200).json(budgetWithExpenses);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get budget with expenses';
      
      if (message === 'Budget not found') {
        res.status(404).json({ message });
        return;
      }
      
      res.status(500).json({ message });
    }
  };

  updateBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      const data: UpdateBudgetDto = req.body;
      const budget = await this.budgetService.updateBudget(id, req.user.id, data);
      
      res.status(200).json(budget);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update budget';
      
      if (message === 'Budget not found') {
        res.status(404).json({ message });
        return;
      }
      
      if (message === 'Cannot edit budget once the period has started') {
        res.status(403).json({ message });
        return;
      }
      
      res.status(400).json({ message });
    }
  };

  deleteBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      await this.budgetService.deleteBudget(id, req.user.id);
      
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete budget';
      
      if (message === 'Budget not found') {
        res.status(404).json({ message });
        return;
      }
      
      res.status(500).json({ message });
    }
  };
}
