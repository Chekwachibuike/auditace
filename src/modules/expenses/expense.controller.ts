import { Response } from 'express';
import { ExpenseService } from './expense.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './expense.dto';
import { UnauthorizedError } from '../../shared/AppError';

export class ExpenseController {
  constructor(private expenseService: ExpenseService) {}

  createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const data: CreateExpenseDto = req.body;
    const expense = await this.expenseService.createExpense(req.user.id, data);

    res.status(201).json(expense);
  };

  getExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const filters: ExpenseFilterDto = {
      month: req.query.month as string,
      category: req.query.category as string,
      search: req.query.search as string,
    };

    const expenses = await this.expenseService.getExpenses(req.user.id, filters);
    res.status(200).json(expenses);
  };

  getExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { id } = req.params;
    const expense = await this.expenseService.getExpense(id, req.user.id);

    res.status(200).json(expense);
  };

  updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { id } = req.params;
    const data: UpdateExpenseDto = req.body;
    const expense = await this.expenseService.updateExpense(id, req.user.id, data);

    res.status(200).json(expense);
  };

  deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const { id } = req.params;
    await this.expenseService.deleteExpense(id, req.user.id);

    res.status(204).send();
  };

  getCategories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('User not authenticated');

    const categories = await this.expenseService.getCategories(req.user.id);
    res.status(200).json(categories);
  };
}
