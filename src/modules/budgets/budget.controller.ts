import { Response } from 'express';
import { BudgetService } from './budget.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { CreateBudgetDto, UpdateBudgetDto, BudgetFilterDto } from './budget.dto';
import { UnauthorizedError } from '../../shared/AppError';

export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  createBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const data: CreateBudgetDto = req.body;
    const budget = await this.budgetService.createBudget(req.user.id, data);

    res.status(201).json(budget);
  };

  getBudgets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const filters: BudgetFilterDto = {
      category: req.query.category as string,
      period: req.query.period as string,
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
    };

    const budgets = await this.budgetService.getBudgets(req.user.id, filters);
    res.status(200).json(budgets);
  };

  getBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { id } = req.params;
    const budget = await this.budgetService.getBudget(id, req.user.id);

    res.status(200).json(budget);
  };

  getBudgetWithExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { id } = req.params;
    const budgetWithExpenses = await this.budgetService.getBudgetWithExpenses(req.user.id, id);

    res.status(200).json(budgetWithExpenses);
  };

  updateBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { id } = req.params;
    const data: UpdateBudgetDto = req.body;
    const budget = await this.budgetService.updateBudget(id, req.user.id, data);

    res.status(200).json(budget);
  };

  deleteBudget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { id } = req.params;
    await this.budgetService.deleteBudget(id, req.user.id);

    res.status(204).send();
  };
}
