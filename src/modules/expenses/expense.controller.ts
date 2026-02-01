import { Request, Response } from 'express';
import { ExpenseService } from './expense.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseFilterDto } from './expense.dto';

export class ExpenseController {
  constructor(private expenseService: ExpenseService) {}

  createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const data: CreateExpenseDto = req.body;
      const expense = await this.expenseService.createExpense(req.user.id, data);
      
      res.status(201).json(expense);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create expense';
      res.status(400).json({ message });
    }
  };

  getExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const filters: ExpenseFilterDto = {
        month: req.query.month as string,
        category: req.query.category as string,
        search: req.query.search as string,
      };

      const expenses = await this.expenseService.getExpenses(req.user.id, filters);
      res.status(200).json(expenses);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get expenses';
      res.status(500).json({ message });
    }
  };

  getExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      const expense = await this.expenseService.getExpense(id, req.user.id);
      
      res.status(200).json(expense);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get expense';
      
      if (message === 'Expense not found') {
        res.status(404).json({ message });
        return;
      }
      
      res.status(500).json({ message });
    }
  };

  updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      const data: UpdateExpenseDto = req.body;
      const expense = await this.expenseService.updateExpense(id, req.user.id, data);
      
      res.status(200).json(expense);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update expense';
      
      if (message === 'Expense not found') {
        res.status(404).json({ message });
        return;
      }
      
      res.status(400).json({ message });
    }
  };

  deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      await this.expenseService.deleteExpense(id, req.user.id);
      
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete expense';
      
      if (message === 'Expense not found') {
        res.status(404).json({ message });
        return;
      }
      
      res.status(500).json({ message });
    }
  };

  getCategories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const categories = await this.expenseService.getCategories(req.user.id);
      res.status(200).json(categories);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get categories';
      res.status(500).json({ message });
    }
  };
}
