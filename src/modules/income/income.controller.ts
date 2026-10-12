import { Response } from 'express';
import { IncomeService } from './income.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { CreateIncomeDto, UpdateIncomeDto, IncomeFilterDto } from './income.dto';
import { UnauthorizedError } from '../../shared/AppError';

export class IncomeController {
  constructor(private incomeService: IncomeService) {}

  createIncome = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(201).json(await this.incomeService.createIncome(req.user.id, req.body as CreateIncomeDto));
  };

  getIncomes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    const filters: IncomeFilterDto = {
      month: req.query.month as string,
      category: req.query.category as string,
      search: req.query.search as string,
    };
    res.status(200).json(await this.incomeService.getIncomes(req.user.id, filters));
  };

  getIncome = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(await this.incomeService.getIncome(req.params.id, req.user.id));
  };

  updateIncome = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(
      await this.incomeService.updateIncome(req.params.id, req.user.id, req.body as UpdateIncomeDto),
    );
  };

  deleteIncome = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    await this.incomeService.deleteIncome(req.params.id, req.user.id);
    res.status(204).send();
  };

  getCategories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');
    res.status(200).json(await this.incomeService.getCategories(req.user.id));
  };
}
