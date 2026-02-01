import { Router } from 'express';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetRepository } from './budget.repository';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

const asyncHandler =
  (fn: (req: import('express').Request, res: import('express').Response) => Promise<void>) =>
  (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

const budgetRepository = new BudgetRepository();
const budgetService = new BudgetService(budgetRepository);
const budgetController = new BudgetController(budgetService);

/**
 * @swagger
 * /budgets:
 *   post:
 *     summary: Create a new budget
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBudgetDto'
 *     responses:
 *       201:
 *         description: Budget created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Budget'
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, asyncHandler(budgetController.createBudget));

/**
 * @swagger
 * /budgets:
 *   get:
 *     summary: Get all budgets for current user
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [monthly, weekly, yearly]
 *         description: Filter by period
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of budgets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Budget'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, asyncHandler(budgetController.getBudgets));

/**
 * @swagger
 * /budgets/{id}:
 *   get:
 *     summary: Get a specific budget
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Budget details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Budget'
 *       404:
 *         description: Budget not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', authenticateToken, asyncHandler(budgetController.getBudget));

/**
 * @swagger
 * /budgets/{id}/expenses:
 *   get:
 *     summary: Get budget with expense comparison
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Budget with expense comparison
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 budget:
 *                   $ref: '#/components/schemas/Budget'
 *                 totalSpent:
 *                   type: number
 *                 remaining:
 *                   type: number
 *                 percentageUsed:
 *                   type: number
 *                 expenses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Expense'
 *       404:
 *         description: Budget not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/expenses', authenticateToken, asyncHandler(budgetController.getBudgetWithExpenses));

/**
 * @swagger
 * /budgets/{id}:
 *   put:
 *     summary: Update a budget
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *               period:
 *                 type: string
 *                 enum: [monthly, weekly, yearly]
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Budget updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Budget'
 *       403:
 *         description: Cannot edit budget after period starts
 *       404:
 *         description: Budget not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', authenticateToken, asyncHandler(budgetController.updateBudget));

/**
 * @swagger
 * /budgets/{id}:
 *   delete:
 *     summary: Delete a budget
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Budget deleted successfully
 *       404:
 *         description: Budget not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authenticateToken, asyncHandler(budgetController.deleteBudget));

export default router;
